import { Queue } from "bullmq";
import { getRedisClient } from "@/lib/redis/client";

export const EMAIL_QUEUE_NAME = "campaign-email";
export const BOUNCE_QUEUE_NAME = "campaign-bounce";
export const API_EMAIL_QUEUE_NAME = "api-email";

export type EmailQueueJob = {
  emailJobId: string;
  campaignId: string;
  recipientId: string;
  senderEmail: string;
};

export type BounceQueueJob = {
  campaignId?: string;
  applicationId?: string;
  senderEmail: string;
  checkNumber: number;
  totalChecks: number;
};

export type ApiEmailQueueJob = {
  apiEmailTaskId: string;
};

export function getEmailQueue() {
  return new Queue<EmailQueueJob>(EMAIL_QUEUE_NAME, {
    connection: getRedisClient()
  });
}

export function getBounceQueue() {
  return new Queue<BounceQueueJob>(BOUNCE_QUEUE_NAME, {
    connection: getRedisClient()
  });
}

export function getApiEmailQueue() {
  return new Queue<ApiEmailQueueJob>(API_EMAIL_QUEUE_NAME, {
    connection: getRedisClient()
  });
}

export async function enqueueCampaignRecipient(job: EmailQueueJob, delayMs = 0): Promise<string> {
  const queue = getEmailQueue();
  const queued = await queue.add("send-recipient", job, {
    delay: delayMs,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 30000
    },
    removeOnComplete: 1000,
    removeOnFail: 5000
  });

  return queued.id ?? "";
}

export async function enqueueBounceCheck(job: BounceQueueJob, delayMs = 0): Promise<string> {
  const queue = getBounceQueue();
  const ownerId = job.campaignId ?? job.applicationId;

  if (!ownerId) {
    throw new Error("Informe campanha ou aplicação para checar bounces.");
  }

  const queued = await queue.add("check-bounces", job, {
    delay: delayMs,
    attempts: 2,
    backoff: {
      type: "fixed",
      delay: 60000
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
    jobId: `${ownerId}:bounce:${job.checkNumber}`
  });

  return queued.id ?? "";
}

export async function enqueueApiEmail(job: ApiEmailQueueJob, delayMs = 0): Promise<string> {
  const queue = getApiEmailQueue();
  const queued = await queue.add("send-api-email", job, {
    delay: delayMs,
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 30000
    },
    removeOnComplete: 1000,
    removeOnFail: 5000
  });

  return queued.id ?? "";
}
