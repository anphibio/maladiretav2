import { AuditAction, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";
import { sendZimbraEmail } from "@/services/zimbra/zimbra-service";
import { validateZimbraCredentials } from "@/services/zimbra/zimbra-service";
import { enqueueCampaignRecipient } from "@/services/queue/email-queue";
import { registerAuditLog } from "@/services/audit/audit-service";
import { getSystemSettings } from "@/services/settings/settings-service";
import {
  getTemporaryLoginCredential,
  storeTemporaryLoginCredential,
  storeTemporaryZimbraCredential
} from "@/services/zimbra/credential-vault";
import type { QueueCampaignInput, SendTestInput } from "@/features/campaigns/send-schemas";

const ONE_HOUR_MS = 60 * 60 * 1000;

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

const sensitiveDomainDefaults = new Map([
  ["outlook.com", { messagesPerMinute: 1, delayMs: 60000 }],
  ["hotmail.com", { messagesPerMinute: 1, delayMs: 60000 }],
  ["live.com", { messagesPerMinute: 1, delayMs: 60000 }],
  ["msn.com", { messagesPerMinute: 1, delayMs: 60000 }]
]);

const microsoftDomains = new Set(sensitiveDomainDefaults.keys());

const microsoftPolicy: RatePolicy = {
  minDelayMs: 60000,
  maxDelayMs: 90000,
  pauseEveryEmails: 15,
  pauseDurationMs: 600000,
  hourlyEmailLimit: 60
};

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

function buildDomainPolicy(input: {
  domain: string;
  configured?: { messagesPerMinute: number; delayMs: number } | null;
  defaultPolicy: RatePolicy;
}): RatePolicy {
  const sensitiveDefault = sensitiveDomainDefaults.get(input.domain);
  const legacyDelayMs =
    input.configured?.delayMs ??
    sensitiveDefault?.delayMs;
  const legacyHourlyLimit =
    input.configured?.messagesPerMinute ??
    sensitiveDefault?.messagesPerMinute;

  const policy: RatePolicy = legacyDelayMs
    ? {
        minDelayMs: legacyDelayMs,
        maxDelayMs: legacyDelayMs,
        pauseEveryEmails: input.defaultPolicy.pauseEveryEmails,
        pauseDurationMs: input.defaultPolicy.pauseDurationMs,
        hourlyEmailLimit: Math.max(1, (legacyHourlyLimit ?? input.defaultPolicy.hourlyEmailLimit) * 60)
      }
    : input.defaultPolicy;

  if (!microsoftDomains.has(input.domain)) {
    return policy;
  }

  return {
    minDelayMs: Math.max(policy.minDelayMs, microsoftPolicy.minDelayMs),
    maxDelayMs: Math.max(policy.maxDelayMs, microsoftPolicy.maxDelayMs),
    pauseEveryEmails: Math.min(policy.pauseEveryEmails, microsoftPolicy.pauseEveryEmails),
    pauseDurationMs: Math.max(policy.pauseDurationMs, microsoftPolicy.pauseDurationMs),
    hourlyEmailLimit: Math.min(policy.hourlyEmailLimit, microsoftPolicy.hourlyEmailLimit)
  };
}

export async function sendCampaignTest(input: {
  campaignId: string;
  user: User;
  payload: SendTestInput;
}) {
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: input.campaignId,
      ...(input.user.role === "OPERATOR" ? { ownerUserId: input.user.id } : {})
    },
    include: {
      attachments: true
    }
  });

  if (!campaign) {
    throw new Error("Campanha não encontrada ou sem permissão.");
  }

  if (campaign.senderEmail !== input.user.email) {
    throw new Error("O remetente da campanha não corresponde ao usuário autenticado.");
  }

  const result = await sendZimbraEmail({
    email: input.user.email,
    password: input.payload.password,
    to: input.payload.recipientEmail,
    subject: `[TESTE] ${campaign.subject}`,
    html: campaign.htmlBody,
    text: campaign.textBody,
    attachments: campaign.attachments.map((attachment) => ({
      filename: attachment.filename,
      contentType: attachment.contentType,
      content: Buffer.from(attachment.content)
    }))
  });

  await prisma.emailLog.create({
    data: {
      campaignId: campaign.id,
      recipientEmail: input.payload.recipientEmail,
      senderEmail: input.user.email,
      status: "TEST_SENT",
      smtpResponse: result.response,
      attempts: 1,
      sentAt: new Date()
    }
  });

  await registerAuditLog({
    userId: input.user.id,
    userEmail: input.user.email,
    action: AuditAction.CAMPAIGN_SENT,
    entityType: "campaign",
    entityId: campaign.id,
    metadata: {
      kind: "test",
      recipientEmail: input.payload.recipientEmail
    }
  });

  return result;
}

export async function prepareCampaignQueue(input: { campaignId: string; user: User; payload: QueueCampaignInput }) {
  const settings = await getSystemSettings();
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: input.campaignId,
      ...(input.user.role === "OPERATOR" ? { ownerUserId: input.user.id } : {})
    },
    include: {
      recipients: {
        where: {
          status: "PENDING"
        },
        orderBy: {
          createdAt: "asc"
        }
      }
    }
  });

  if (!campaign) {
    throw new Error("Campanha não encontrada ou sem permissão.");
  }

  if (campaign.status !== "DRAFT" && campaign.status !== "PAUSED" && campaign.status !== "SCHEDULED" && campaign.status !== "QUEUED") {
    throw new Error("Apenas campanhas em rascunho, agendadas, pausadas ou em fila podem ser colocadas em fila.");
  }

  if (campaign.recipients.length === 0) {
    throw new Error("Importe destinatários antes de iniciar a campanha.");
  }

  if (campaign.recipients.length > settings.maxRecipientsPerCampaign) {
    throw new Error("A campanha excede o limite máximo de destinatários configurado.");
  }

  const dispatchEnabled = settings.queueDispatchEnabled && process.env.QUEUE_DISPATCH_ENABLED === "true";

  if (dispatchEnabled) {
    const loginCredential = await getTemporaryLoginCredential(input.user.email);
    const password = input.payload.password ?? loginCredential?.password;

    if (!password) {
      throw new Error("Faça login novamente para atualizar a credencial temporária antes do disparo automático.");
    }

    await validateZimbraCredentials({
      email: input.user.email,
      password
    });

    if (input.payload.password) {
      await storeTemporaryLoginCredential({
        email: input.user.email,
        password
      });
    }

    await storeTemporaryZimbraCredential({
      campaignId: campaign.id,
      email: input.user.email,
      password
    });
  }

  const configuredLimits = await prisma.domainRateLimit.findMany({
    where: { active: true }
  });
  const configuredByDomain = new Map(configuredLimits.map((limit) => [limit.domain, limit]));
  const defaultPolicy: RatePolicy = {
    minDelayMs: settings.defaultMinEmailDelayMs,
    maxDelayMs: settings.defaultMaxEmailDelayMs,
    pauseEveryEmails: settings.defaultPauseEveryEmails,
    pauseDurationMs: settings.defaultPauseDurationMs,
    hourlyEmailLimit: settings.defaultHourlyEmailLimit
  };
  const globalRateState = createRateState();
  const domainOffsets = new Map<string, number>();
  const domainStates = new Map<string, RateState>();
  const now = Date.now();

  const createdJobs = await prisma.$transaction(async (tx) => {
    await tx.campaign.update({
      where: { id: campaign.id },
      data: {
        status: "QUEUED",
        startedAt: new Date()
      }
    });

    await tx.emailJob.deleteMany({
      where: {
        campaignId: campaign.id,
        status: "WAITING"
      }
    });

    const jobs = [];

    for (const recipient of campaign.recipients) {
      const configured = configuredByDomain.get(recipient.domain);
      const domainPolicy = buildDomainPolicy({
        domain: recipient.domain,
        configured,
        defaultPolicy
      });
      const domainState = domainStates.get(recipient.domain) ?? createRateState();
      const globalOffset = reserveSendOffset(globalRateState, defaultPolicy);
      const domainOffset = reserveSendOffset(domainState, domainPolicy);
      const currentOffset = Math.max(globalOffset, domainOffset, domainOffsets.get(recipient.domain) ?? 0);
      const scheduledAt = new Date(now + currentOffset);

      domainStates.set(recipient.domain, domainState);
      domainOffsets.set(recipient.domain, currentOffset);

      const job = await tx.emailJob.create({
        data: {
          campaignId: campaign.id,
          recipientId: recipient.id,
          status: "WAITING",
          scheduledAt
        }
      });

      jobs.push({ job, delayMs: currentOffset, recipientId: recipient.id });
    }

    return jobs;
  });

  if (dispatchEnabled) {
    try {
      for (const item of createdJobs) {
        const queueJobId = await enqueueCampaignRecipient(
          {
            campaignId: campaign.id,
            recipientId: item.recipientId,
            senderEmail: input.user.email,
            emailJobId: item.job.id
          },
          item.delayMs
        );

        await prisma.emailJob.update({
          where: { id: item.job.id },
          data: { queueJobId }
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Redis indisponível para enfileirar a campanha.";

      await prisma.$transaction([
        prisma.emailJob.updateMany({
          where: { campaignId: campaign.id, status: "WAITING" },
          data: {
            status: "FAILED",
            lastError: message
          }
        }),
        prisma.campaignRecipient.updateMany({
          where: { campaignId: campaign.id, status: "PENDING" },
          data: {
            status: "FAILED",
            errorMessage: "Fila de envio indisponível. Verifique Redis e worker."
          }
        }),
        prisma.campaign.update({
          where: { id: campaign.id },
          data: {
            status: "FAILED",
            finishedAt: new Date()
          }
        })
      ]);

      throw new Error("Não foi possível conectar ao Redis para enfileirar a campanha. Suba o Docker Compose e reinicie o worker.");
    }
  }

  await registerAuditLog({
    userId: input.user.id,
    userEmail: input.user.email,
    action: AuditAction.CAMPAIGN_SENT,
    entityType: "campaign",
    entityId: campaign.id,
    metadata: {
      kind: "queue_prepared",
      recipients: campaign.recipients.length,
      dispatchEnabled
    }
  });

  return {
    jobsCreated: createdJobs.length,
    dispatchEnabled
  };
}
