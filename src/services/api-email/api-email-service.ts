import { ApiEmailTaskStatus, type Application, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";
import { enqueueApiEmail } from "@/services/queue/email-queue";
import { getSystemSettings } from "@/services/settings/settings-service";
import { decryptApplicationCredential } from "@/services/api-email/api-application-service";
import type { SendApiEmailItem } from "@/features/api-email/schemas";

type RatePolicy = {
  minDelayMs: number;
  maxDelayMs: number;
  pauseEveryEmails: number;
  pauseDurationMs: number;
  hourlyEmailLimit: number;
};

type RateState = {
  offsetMs: number;
  sentInHour: number;
  hourWindowStartMs: number;
  sentTotal: number;
};

const ONE_HOUR_MS = 60 * 60 * 1000;
const API_EMAIL_RETENTION_DAYS = 30;
const API_EMAIL_RETENTION_MS = API_EMAIL_RETENTION_DAYS * 24 * 60 * 60 * 1000;

type ApiEmailEventWriter = Prisma.TransactionClient | typeof prisma;

function normalizeTask(input: SendApiEmailItem) {
  const body = input.body ?? input.htmlBody ?? input.textBody ?? "";
  return {
    toEmail: input.toEmail.trim().toLowerCase(),
    subject: input.subject.trim(),
    htmlBody: input.htmlBody ?? body,
    textBody: input.textBody ?? body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    externalReferenceId: input.externalReferenceId?.trim() || undefined
  };
}

export async function registerApiEmailEvent(
  client: ApiEmailEventWriter,
  input: {
    applicationId: string;
    taskId: string;
    recipientEmail: string;
    senderEmail: string;
    status: ApiEmailTaskStatus;
    externalReferenceId?: string | null;
    message?: string | null;
    smtpResponse?: string | null;
    attempts?: number;
  }
) {
  return client.apiEmailEvent.create({
    data: {
      applicationId: input.applicationId,
      taskId: input.taskId,
      recipientEmail: input.recipientEmail,
      senderEmail: input.senderEmail,
      status: input.status,
      externalReferenceId: input.externalReferenceId,
      message: input.message,
      smtpResponse: input.smtpResponse,
      attempts: input.attempts ?? 0
    }
  });
}

function randomBetween(min: number, max: number): number {
  if (max <= min) {
    return min;
  }

  return min + Math.floor(Math.random() * (max - min + 1));
}

function createRateState(): RateState {
  return {
    offsetMs: 0,
    sentInHour: 0,
    hourWindowStartMs: 0,
    sentTotal: 0
  };
}

function reserveSendOffset(state: RateState, policy: RatePolicy): number {
  if (state.offsetMs - state.hourWindowStartMs >= ONE_HOUR_MS) {
    state.hourWindowStartMs = Math.floor(state.offsetMs / ONE_HOUR_MS) * ONE_HOUR_MS;
    state.sentInHour = 0;
  }

  if (state.sentInHour >= policy.hourlyEmailLimit) {
    state.hourWindowStartMs += ONE_HOUR_MS;
    state.offsetMs = Math.max(state.offsetMs, state.hourWindowStartMs);
    state.sentInHour = 0;
  }

  const reservedOffset = state.offsetMs;

  state.sentInHour += 1;
  state.sentTotal += 1;
  state.offsetMs += randomBetween(policy.minDelayMs, policy.maxDelayMs);

  if (state.sentTotal % policy.pauseEveryEmails === 0) {
    state.offsetMs += policy.pauseDurationMs;
  }

  return reservedOffset;
}

export async function createApiEmailTasks(input: {
  application: Application;
  items: SendApiEmailItem[];
}) {
  const settings = await getSystemSettings();
  const dispatchEnabled = settings.queueDispatchEnabled && process.env.QUEUE_DISPATCH_ENABLED === "true";

  if (dispatchEnabled && !decryptApplicationCredential(input.application)) {
    throw new Error("A aplicação não possui credencial de remetente configurada.");
  }

  const defaultPolicy: RatePolicy = {
    minDelayMs: settings.defaultMinEmailDelayMs,
    maxDelayMs: settings.defaultMaxEmailDelayMs,
    pauseEveryEmails: settings.defaultPauseEveryEmails,
    pauseDurationMs: settings.defaultPauseDurationMs,
    hourlyEmailLimit: settings.defaultHourlyEmailLimit
  };
  const state = createRateState();
  const now = Date.now();
  const normalizedItems = input.items.map(normalizeTask);

  const tasks = await prisma.$transaction(async (tx) => {
    const created = [];

    for (const item of normalizedItems) {
      const delayMs = reserveSendOffset(state, defaultPolicy);
      const task = await tx.apiEmailTask.create({
        data: {
          applicationId: input.application.id,
          toEmail: item.toEmail,
          subject: item.subject,
          htmlBody: item.htmlBody,
          textBody: item.textBody,
          externalReferenceId: item.externalReferenceId,
          senderEmail: input.application.senderEmail,
          status: "QUEUED",
          scheduledAt: new Date(now + delayMs)
        }
      });
      await registerApiEmailEvent(tx, {
        applicationId: task.applicationId,
        taskId: task.id,
        recipientEmail: task.toEmail,
        senderEmail: task.senderEmail,
        status: ApiEmailTaskStatus.QUEUED,
        externalReferenceId: task.externalReferenceId,
        message: "E-mail recebido pela API e colocado na fila."
      });

      created.push({ task, delayMs });
    }

    return created;
  });

  if (dispatchEnabled) {
    try {
      for (const item of tasks) {
        const queueJobId = await enqueueApiEmail({ apiEmailTaskId: item.task.id }, item.delayMs);

        await prisma.apiEmailTask.update({
          where: { id: item.task.id },
          data: { queueJobId }
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Redis indisponível para enfileirar e-mail via API.";

      await prisma.apiEmailTask.updateMany({
        where: {
          id: { in: tasks.map((item) => item.task.id) }
        },
        data: {
          status: "FAILED",
          lastError: message
        }
      });
      await prisma.$transaction(async (tx) => {
        for (const item of tasks) {
          await registerApiEmailEvent(tx, {
            applicationId: item.task.applicationId,
            taskId: item.task.id,
            recipientEmail: item.task.toEmail,
            senderEmail: item.task.senderEmail,
            status: ApiEmailTaskStatus.FAILED,
            externalReferenceId: item.task.externalReferenceId,
            message
          });
        }
      });

      throw new Error("Não foi possível conectar ao Redis para enfileirar os e-mails via API.");
    }
  }

  return {
    dispatchEnabled,
    items: tasks.map(({ task }) => ({
      id: task.id,
      externalReferenceId: task.externalReferenceId,
      status: task.status,
      scheduledAt: task.scheduledAt
    }))
  };
}

export async function listApiEmailQueue(input: {
  applicationId: string;
  page: number;
  pageSize: number;
}) {
  const where = {
    applicationId: input.applicationId,
    status: { in: ["QUEUED", "SENDING"] as ApiEmailTaskStatus[] }
  };
  const [total, items] = await Promise.all([
    prisma.apiEmailTask.count({ where }),
    prisma.apiEmailTask.findMany({
      where,
      orderBy: {
        createdAt: "desc"
      },
      skip: (input.page - 1) * input.pageSize,
      take: input.pageSize
    })
  ]);

  return {
    page: input.page,
    pageSize: input.pageSize,
    total,
    items
  };
}

export async function getApiEmailStatus(input: { applicationId: string; id: string }) {
  return prisma.apiEmailTask.findFirst({
    where: {
      id: input.id,
      applicationId: input.applicationId
    },
    include: {
      events: {
        orderBy: {
          createdAt: "desc"
        },
        take: 20
      }
    }
  });
}

export async function listRecentApiEmailTasks() {
  return prisma.apiEmailTask.findMany({
    include: {
      application: true
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 20
  });
}

export async function listApiEmailLogs(input?: {
  applicationId?: string;
  status?: ApiEmailTaskStatus;
  search?: string;
  page?: number;
  pageSize?: number;
}) {
  const page = input?.page ?? 1;
  const pageSize = input?.pageSize ?? 50;
  const search = input?.search?.trim();
  const where: Prisma.ApiEmailTaskWhereInput = {
    ...(input?.applicationId ? { applicationId: input.applicationId } : {}),
    ...(input?.status ? { status: input.status } : {}),
    ...(search
      ? {
          OR: [
            { toEmail: { contains: search, mode: "insensitive" } },
            { senderEmail: { contains: search, mode: "insensitive" } },
            { externalReferenceId: { contains: search, mode: "insensitive" } },
            { lastError: { contains: search, mode: "insensitive" } },
            { smtpResponse: { contains: search, mode: "insensitive" } },
            {
              events: {
                some: {
                  OR: [
                    { message: { contains: search, mode: "insensitive" } },
                    { smtpResponse: { contains: search, mode: "insensitive" } }
                  ]
                }
              }
            }
          ]
        }
      : {})
  };

  const [total, items] = await Promise.all([
    prisma.apiEmailTask.count({ where }),
    prisma.apiEmailTask.findMany({
      where,
      include: {
        application: true,
        events: {
          orderBy: {
            createdAt: "desc"
          },
          take: 1
        }
      },
      orderBy: {
        updatedAt: "desc"
      },
      skip: (page - 1) * pageSize,
      take: pageSize
    })
  ]);

  return {
    page,
    pageSize,
    total,
    retentionDays: API_EMAIL_RETENTION_DAYS,
    items: items.map((item) => {
      const latestEvent = item.events[0];

      return {
        id: item.id,
        applicationId: item.applicationId,
        applicationName: item.application.name,
        recipientEmail: item.toEmail,
        senderEmail: item.senderEmail,
        status: item.status,
        externalReferenceId: item.externalReferenceId,
        message: latestEvent?.message ?? item.lastError,
        smtpResponse: latestEvent?.smtpResponse ?? item.smtpResponse,
        attempts: item.attempts,
        updatedAt: item.updatedAt,
        createdAt: item.createdAt
      };
    })
  };
}

export async function markApiEmailTaskBounced(input: {
  taskId?: string;
  recipientEmail?: string;
  senderEmail?: string;
  reason: string;
}) {
  const normalizedRecipient = input.recipientEmail?.trim().toLowerCase();
  const normalizedSender = input.senderEmail?.trim().toLowerCase();
  const task = input.taskId
    ? await prisma.apiEmailTask.findUnique({
        where: { id: input.taskId },
        include: { application: true }
      })
    : normalizedRecipient
      ? await prisma.apiEmailTask.findFirst({
          where: {
            toEmail: normalizedRecipient,
            ...(normalizedSender ? { senderEmail: normalizedSender } : {}),
            status: { in: [ApiEmailTaskStatus.SENT, ApiEmailTaskStatus.SENDING, ApiEmailTaskStatus.QUEUED] },
            createdAt: {
              gte: new Date(Date.now() - API_EMAIL_RETENTION_MS)
            }
          },
          include: { application: true },
          orderBy: { createdAt: "desc" }
        })
      : null;

  if (!task) {
    return null;
  }

  if (task.status === ApiEmailTaskStatus.BOUNCED) {
    return task;
  }

  return prisma.$transaction(async (tx) => {
    const updated = await tx.apiEmailTask.update({
      where: { id: task.id },
      data: {
        status: ApiEmailTaskStatus.BOUNCED,
        lastError: input.reason,
        bouncedAt: new Date()
      }
    });

    await registerApiEmailEvent(tx, {
      applicationId: task.applicationId,
      taskId: task.id,
      recipientEmail: task.toEmail,
      senderEmail: task.senderEmail,
      status: ApiEmailTaskStatus.BOUNCED,
      externalReferenceId: task.externalReferenceId,
      message: input.reason,
      smtpResponse: task.smtpResponse,
      attempts: task.attempts
    });

    return updated;
  });
}

export async function cleanupOldApiEmailLogs() {
  const cutoff = new Date(Date.now() - API_EMAIL_RETENTION_MS);
  const [events, tasks] = await prisma.$transaction([
    prisma.apiEmailEvent.deleteMany({
      where: {
        createdAt: {
          lt: cutoff
        }
      }
    }),
    prisma.apiEmailTask.deleteMany({
      where: {
        createdAt: {
          lt: cutoff
        },
        events: {
          none: {
            createdAt: {
              gte: cutoff
            }
          }
        }
      }
    })
  ]);

  return {
    retentionDays: API_EMAIL_RETENTION_DAYS,
    deletedEvents: events.count,
    deletedTasks: tasks.count
  };
}
