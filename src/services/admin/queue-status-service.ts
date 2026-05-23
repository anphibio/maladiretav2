import { prisma } from "@/lib/prisma/client";

export async function getQueueStatusSummary() {
  const [waiting, active, completed, failed, apiQueued, apiSending, apiFailed, queuedCampaigns, sendingCampaigns] = await Promise.all([
    prisma.emailJob.count({ where: { status: "WAITING" } }),
    prisma.emailJob.count({ where: { status: "ACTIVE" } }),
    prisma.emailJob.count({ where: { status: "COMPLETED" } }),
    prisma.emailJob.count({ where: { status: "FAILED" } }),
    prisma.apiEmailTask.count({ where: { status: "QUEUED" } }),
    prisma.apiEmailTask.count({ where: { status: "SENDING" } }),
    prisma.apiEmailTask.count({ where: { status: { in: ["FAILED", "BOUNCED"] } } }),
    prisma.campaign.count({ where: { status: "QUEUED" } }),
    prisma.campaign.count({ where: { status: "SENDING" } })
  ]);

  return {
    waiting: waiting + apiQueued,
    active: active + apiSending,
    completed,
    failed: failed + apiFailed,
    queuedCampaigns,
    sendingCampaigns,
    apiQueued,
    apiSending,
    apiFailed
  };
}
