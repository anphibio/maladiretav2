import { subDays, format } from "date-fns";
import type { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";

function canViewAll(user: User): boolean {
  return user.role === "ADMIN" || user.role === "AUDITOR";
}

function campaignScope(user: User): Prisma.CampaignWhereInput {
  return canViewAll(user) ? {} : { ownerUserId: user.id };
}

function emailLogScope(user: User): Prisma.EmailLogWhereInput {
  return canViewAll(user) ? {} : { senderEmail: user.email };
}

export async function getDashboardMetrics(user: User) {
  const campaignsWhere = campaignScope(user);
  const emailLogsWhere = emailLogScope(user);
  const failureWhere: Prisma.EmailLogWhereInput = {
    ...emailLogsWhere,
    status: { contains: "FAIL", mode: "insensitive" }
  };

  const [campaigns, sentEmails, failures, scheduled, queueWaiting, queueFailed] = await Promise.all([
    prisma.campaign.count({ where: campaignsWhere }),
    prisma.emailLog.count({
      where: {
        ...emailLogsWhere,
        OR: [{ status: { contains: "SENT", mode: "insensitive" } }, { status: { contains: "TEST_SENT", mode: "insensitive" } }]
      }
    }),
    prisma.emailLog.count({ where: failureWhere }),
    prisma.campaign.count({ where: { ...campaignsWhere, status: "SCHEDULED" } }),
    prisma.emailJob.count({
      where: canViewAll(user)
        ? { status: "WAITING" }
        : {
            status: "WAITING",
            campaign: { ownerUserId: user.id }
          }
    }),
    prisma.emailJob.count({
      where: canViewAll(user)
        ? { status: "FAILED" }
        : {
            status: "FAILED",
            campaign: { ownerUserId: user.id }
          }
    })
  ]);

  return {
    campaigns,
    sentEmails,
    failures,
    scheduled,
    queueWaiting,
    queueFailed,
    successRate: sentEmails + failures === 0 ? 0 : Math.round((sentEmails / (sentEmails + failures)) * 100)
  };
}

export async function getDailySendSeries(user: User) {
  const start = subDays(new Date(), 6);
  const logs = await prisma.emailLog.findMany({
    where: {
      ...emailLogScope(user),
      createdAt: { gte: start }
    },
    select: {
      status: true,
      createdAt: true
    },
    orderBy: {
      createdAt: "asc"
    }
  });

  const buckets = new Map<string, { day: string; enviados: number; falhas: number }>();

  for (let index = 6; index >= 0; index -= 1) {
    const date = subDays(new Date(), index);
    const key = format(date, "yyyy-MM-dd");
    buckets.set(key, { day: format(date, "dd/MM"), enviados: 0, falhas: 0 });
  }

  logs.forEach((log) => {
    const key = format(log.createdAt, "yyyy-MM-dd");
    const bucket = buckets.get(key);

    if (!bucket) {
      return;
    }

    if (log.status.toUpperCase().includes("FAIL")) {
      bucket.falhas += 1;
    } else {
      bucket.enviados += 1;
    }
  });

  return Array.from(buckets.values());
}

export async function getFailureDomains(user: User) {
  const logs = await prisma.emailLog.findMany({
    where: {
      ...emailLogScope(user),
      status: { contains: "FAIL", mode: "insensitive" }
    },
    select: {
      recipientEmail: true
    },
    take: 1000
  });
  const counts = new Map<string, number>();

  logs.forEach((log) => {
    const domain = log.recipientEmail.split("@")[1]?.toLowerCase() ?? "desconhecido";
    counts.set(domain, (counts.get(domain) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([domain, failures]) => ({ domain, failures }))
    .sort((a, b) => b.failures - a.failures)
    .slice(0, 6);
}

export async function getRecentCampaigns(user: User) {
  return prisma.campaign.findMany({
    where: campaignScope(user),
    select: {
      id: true,
      name: true,
      status: true,
      senderEmail: true,
      createdAt: true,
      _count: {
        select: { recipients: true }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 5
  });
}

export async function getDashboardData(user: User) {
  const [metrics, dailySeries, failureDomains, recentCampaigns] = await Promise.all([
    getDashboardMetrics(user),
    getDailySendSeries(user),
    getFailureDomains(user),
    getRecentCampaigns(user)
  ]);

  return { metrics, dailySeries, failureDomains, recentCampaigns };
}
