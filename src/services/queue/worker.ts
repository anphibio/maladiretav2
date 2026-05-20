import { Worker } from "bullmq";
import { prisma } from "@/lib/prisma/client";
import { getRedisClient } from "@/lib/redis/client";
import {
  API_EMAIL_QUEUE_NAME,
  BOUNCE_QUEUE_NAME,
  EMAIL_QUEUE_NAME,
  enqueueBounceCheck,
  type ApiEmailQueueJob,
  type BounceQueueJob,
  type EmailQueueJob
} from "@/services/queue/email-queue";
import { decryptApplicationCredential } from "@/services/api-email/api-application-service";
import { processBounceMailbox } from "@/services/bounces/bounce-service";
import { reconcileCampaignDeliveryStatus } from "@/services/campaigns/campaign-service";
import {
  deleteAutoBounceChecksScheduled,
  deleteTemporaryZimbraCredential,
  getTemporaryLoginCredential,
  getTemporaryZimbraCredential,
  reserveAutoBounceChecksSchedule
} from "@/services/zimbra/credential-vault";
import { sendZimbraEmail } from "@/services/zimbra/zimbra-service";

const AUTO_BOUNCE_CHECK_DELAYS_MS = [2 * 60 * 1000, 15 * 60 * 1000, 60 * 60 * 1000];

async function countPendingEmailJobs(campaignId: string) {
  return prisma.emailJob.count({
    where: {
      campaignId,
      status: { in: ["WAITING", "ACTIVE", "RETRYING"] }
    }
  });
}

async function ensureAutomaticBounceChecks(campaignId: string, senderEmail: string) {
  const reserved = await reserveAutoBounceChecksSchedule(campaignId);

  if (!reserved) {
    return;
  }

  await Promise.all(
    AUTO_BOUNCE_CHECK_DELAYS_MS.map((delayMs, index) =>
      enqueueBounceCheck(
        {
          campaignId,
          senderEmail,
          checkNumber: index + 1,
          totalChecks: AUTO_BOUNCE_CHECK_DELAYS_MS.length
        },
        delayMs
      )
    )
  );
}

new Worker<EmailQueueJob>(
  EMAIL_QUEUE_NAME,
  async (job) => {
    const recipient = await prisma.campaignRecipient.findUnique({
      where: { id: job.data.recipientId },
      include: { campaign: { include: { attachments: true } } }
    });

    if (!recipient) {
      throw new Error("Destinatário não encontrado.");
    }

    await prisma.$transaction([
      prisma.campaign.updateMany({
        where: {
          id: recipient.campaignId,
          status: "QUEUED"
        },
        data: { status: "SENDING" }
      }),
      prisma.emailJob.update({
        where: { id: job.data.emailJobId },
        data: { status: "ACTIVE", attempts: { increment: 1 } }
      })
    ]);

    try {
      const credential = await getTemporaryZimbraCredential(recipient.campaignId);

      if (!credential || credential.email !== job.data.senderEmail) {
        throw new Error("Credencial temporária do Zimbra ausente ou incompatível.");
      }

      const result = await sendZimbraEmail({
        email: credential.email,
        password: credential.password,
        to: recipient.email,
        subject: recipient.campaign.subject,
        html: recipient.campaign.htmlBody,
        text: recipient.campaign.textBody,
        campaignId: recipient.campaignId,
        recipientId: recipient.id,
        attachments: recipient.campaign.attachments.map((attachment) => ({
          filename: attachment.filename,
          contentType: attachment.contentType,
          content: Buffer.from(attachment.content)
        }))
      });

      await prisma.$transaction([
        prisma.emailJob.update({
          where: { id: job.data.emailJobId },
          data: {
            status: "COMPLETED",
            lastError: null
          }
        }),
        prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: "SENT",
            errorMessage: null,
            sentAt: new Date()
          }
        }),
        prisma.emailLog.create({
          data: {
            campaignId: recipient.campaignId,
            recipientEmail: recipient.email,
            senderEmail: job.data.senderEmail,
            status: "SENT",
            smtpResponse: result.response,
            attempts: job.attemptsMade + 1,
            sentAt: new Date()
          }
        })
      ]);

      await reconcileCampaignDeliveryStatus(recipient.campaignId);
      if ((await countPendingEmailJobs(recipient.campaignId)) === 0) {
        await ensureAutomaticBounceChecks(recipient.campaignId, job.data.senderEmail);
      }

      return { sent: true };
    } catch (error) {
      const attemptsUsed = job.attemptsMade + 1;
      const maxAttempts = typeof job.opts.attempts === "number" ? job.opts.attempts : 1;
      const finalAttempt = attemptsUsed >= maxAttempts;
      const message = error instanceof Error ? error.message : "Erro desconhecido no envio SMTP.";

      await prisma.$transaction([
        prisma.emailJob.update({
          where: { id: job.data.emailJobId },
          data: {
            status: finalAttempt ? "FAILED" : "RETRYING",
            lastError: message
          }
        }),
        prisma.campaignRecipient.update({
          where: { id: recipient.id },
          data: {
            status: finalAttempt ? "FAILED" : "PENDING",
            errorMessage: message
          }
        }),
        prisma.emailLog.create({
          data: {
            campaignId: recipient.campaignId,
            recipientEmail: recipient.email,
            senderEmail: job.data.senderEmail,
            status: finalAttempt ? "FAILED" : "RETRYING",
            errorMessage: message,
            attempts: attemptsUsed
          }
        })
      ]);

      if (finalAttempt) {
        await reconcileCampaignDeliveryStatus(recipient.campaignId);
        if ((await countPendingEmailJobs(recipient.campaignId)) === 0) {
          await ensureAutomaticBounceChecks(recipient.campaignId, job.data.senderEmail);
        }
      }

      throw error;
    }
  },
  {
    connection: getRedisClient(),
    concurrency: 3
  }
);

new Worker<ApiEmailQueueJob>(
  API_EMAIL_QUEUE_NAME,
  async (job) => {
    const task = await prisma.apiEmailTask.findUnique({
      where: { id: job.data.apiEmailTaskId },
      include: {
        application: true
      }
    });

    if (!task) {
      throw new Error("Tarefa de e-mail via API não encontrada.");
    }

    if (!task.application.isActive) {
      throw new Error("Aplicação inativa.");
    }

    await prisma.apiEmailTask.update({
      where: { id: task.id },
      data: {
        status: "SENDING",
        attempts: { increment: 1 }
      }
    });

    try {
      const password = decryptApplicationCredential(task.application);

      if (!password) {
        throw new Error("Credencial protegida da aplicação não configurada.");
      }

      const result = await sendZimbraEmail({
        email: task.senderEmail,
        password,
        to: task.toEmail,
        subject: task.subject,
        html: task.htmlBody,
        text: task.textBody
      });

      await prisma.apiEmailTask.update({
        where: { id: task.id },
        data: {
          status: "SENT",
          smtpResponse: result.response,
          lastError: null,
          sentAt: new Date()
        }
      });

      return { sent: true };
    } catch (error) {
      const attemptsUsed = job.attemptsMade + 1;
      const maxAttempts = typeof job.opts.attempts === "number" ? job.opts.attempts : 1;
      const finalAttempt = attemptsUsed >= maxAttempts;
      const message = error instanceof Error ? error.message : "Erro desconhecido no envio via API.";

      await prisma.apiEmailTask.update({
        where: { id: task.id },
        data: {
          status: finalAttempt ? "FAILED" : "QUEUED",
          lastError: message
        }
      });

      throw error;
    }
  },
  {
    connection: getRedisClient(),
    concurrency: 3
  }
);

new Worker<BounceQueueJob>(
  BOUNCE_QUEUE_NAME,
  async (job) => {
    const credential =
      (await getTemporaryZimbraCredential(job.data.campaignId)) ??
      (await getTemporaryLoginCredential(job.data.senderEmail));

    if (!credential || credential.email !== job.data.senderEmail) {
      throw new Error("Credencial temporária indisponível para checar bounces da campanha.");
    }

    const results = await processBounceMailbox({
      email: credential.email,
      password: credential.password
    });

    if (job.data.checkNumber >= job.data.totalChecks) {
      await deleteAutoBounceChecksScheduled(job.data.campaignId);
      await deleteTemporaryZimbraCredential(job.data.campaignId);
    }

    return {
      processed: results.length,
      registered: results.filter((result) => result.ok).length
    };
  },
  {
    connection: getRedisClient(),
    concurrency: 1
  }
);
