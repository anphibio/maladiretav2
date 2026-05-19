import { prisma } from "@/lib/prisma/client";

export async function getQueueStatusSummary() {
  const [waiting, active, completed, failed, queuedCampaigns, sendingCampaigns] = await Promise.all([
    prisma.emailJob.count({ where: { status: "WAITING" } }),
    prisma.emailJob.count({ where: { status: "ACTIVE" } }),
    prisma.emailJob.count({ where: { status: "COMPLETED" } }),
    prisma.emailJob.count({ where: { status: "FAILED" } }),
    prisma.campaign.count({ where: { status: "QUEUED" } }),
    prisma.campaign.count({ where: { status: "SENDING" } })
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    queuedCampaigns,
    sendingCampaigns
  };
}
