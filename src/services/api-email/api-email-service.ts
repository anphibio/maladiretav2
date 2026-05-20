import type { ApiEmailTaskStatus, Application } from "@prisma/client";
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
