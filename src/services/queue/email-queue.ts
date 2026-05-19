import { Queue } from "bullmq";
import { getRedisClient } from "@/lib/redis/client";

export const EMAIL_QUEUE_NAME = "campaign-email";
export const BOUNCE_QUEUE_NAME = "campaign-bounce";

export type EmailQueueJob = {
  emailJobId: string;
  campaignId: string;
  recipientId: string;
  senderEmail: string;
};

export type BounceQueueJob = {
  campaignId: string;
  senderEmail: string;
  checkNumber: number;
  totalChecks: number;
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
  const queued = await queue.add("check-bounces", job, {
    delay: delayMs,
    attempts: 2,
    backoff: {
      type: "fixed",
      delay: 60000
    },
    removeOnComplete: 1000,
    removeOnFail: 5000,
    jobId: `${job.campaignId}:bounce:${job.checkNumber}`
  });

  return queued.id ?? "";
}
