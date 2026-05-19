import { AuditAction, type Prisma, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";
import { toCsv } from "@/services/reports/csv";
import { registerAuditLog } from "@/services/audit/audit-service";
import type { ReportQuery } from "@/features/reports/schemas";

function canViewAll(user: User): boolean {
  return user.role === "ADMIN" || user.role === "AUDITOR";
}

async function auditExport(user: User, type: ReportQuery["type"], metadata: Record<string, unknown>) {
  await registerAuditLog({
    userId: user.id,
    userEmail: user.email,
    action: AuditAction.REPORT_EXPORTED,
    entityType: "report",
    entityId: type,
    metadata: JSON.parse(JSON.stringify(metadata)) as Prisma.InputJsonValue
  });
}

export async function buildCampaignsReport(user: User, query: ReportQuery) {
  const where: Prisma.CampaignWhereInput = {
    ...(canViewAll(user) ? {} : { ownerUserId: user.id }),
    ...(query.q
      ? {
          OR: [
            { name: { contains: query.q, mode: "insensitive" } },
            { subject: { contains: query.q, mode: "insensitive" } },
            { senderEmail: { contains: query.q, mode: "insensitive" } }
          ]
        }
      : {})
  };
  const campaigns = await prisma.campaign.findMany({
    where,
    include: {
      _count: {
        select: { recipients: true, emailJobs: true, emailLogs: true }
      }
    },
    orderBy: { createdAt: "desc" },
    take: query.limit
  });

  await auditExport(user, "campaigns", { rows: campaigns.length, q: query.q });

  return toCsv(
    ["id", "nome", "assunto", "remetente", "status", "destinatarios", "jobs", "logs", "criado_em"],
    campaigns.map((campaign) => [
      campaign.id,
      campaign.name,
      campaign.subject,
      campaign.senderEmail,
      campaign.status,
      campaign._count.recipients,
      campaign._count.emailJobs,
      campaign._count.emailLogs,
      campaign.createdAt
    ])
  );
}

export async function buildFailuresReport(user: User, query: ReportQuery) {
  const where: Prisma.EmailLogWhereInput = {
    status: { contains: "FAIL", mode: "insensitive" },
    ...(canViewAll(user) ? {} : { senderEmail: user.email }),
    ...(query.q
      ? {
          OR: [
            { recipientEmail: { contains: query.q, mode: "insensitive" } },
            { senderEmail: { contains: query.q, mode: "insensitive" } },
            { errorMessage: { contains: query.q, mode: "insensitive" } }
          ]
        }
      : {})
  };
  const logs = await prisma.emailLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: query.limit
  });

  await auditExport(user, "failures", { rows: logs.length, q: query.q });

  return toCsv(
    ["id", "campanha_id", "remetente", "destinatario", "status", "tentativas", "erro", "criado_em"],
    logs.map((log) => [
      log.id,
      log.campaignId,
      log.senderEmail,
      log.recipientEmail,
      log.status,
      log.attempts,
      log.errorMessage,
      log.createdAt
    ])
  );
}

export async function buildAccessReport(user: User, query: ReportQuery) {
  const where: Prisma.AccessLogWhereInput = {
    ...(canViewAll(user) ? {} : { userId: user.id }),
    ...(query.q
      ? {
          OR: [
            { email: { contains: query.q, mode: "insensitive" } },
            { action: { contains: query.q, mode: "insensitive" } },
            { ip: { contains: query.q, mode: "insensitive" } }
          ]
        }
      : {})
  };
  const logs = await prisma.accessLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: query.limit
  });

  await auditExport(user, "access", { rows: logs.length, q: query.q });

  return toCsv(
    ["id", "usuario_id", "email", "acao", "sucesso", "ip", "user_agent", "criado_em"],
    logs.map((log) => [log.id, log.userId, log.email, log.action, log.success, log.ip, log.userAgent, log.createdAt])
  );
}

export async function buildAuditReport(user: User, query: ReportQuery) {
  const where: Prisma.AuditLogWhereInput = {
    ...(canViewAll(user) ? {} : { userId: user.id }),
    ...(query.q
      ? {
          OR: [
            { userEmail: { contains: query.q, mode: "insensitive" } },
            { entityType: { contains: query.q, mode: "insensitive" } },
            { entityId: { contains: query.q, mode: "insensitive" } }
          ]
        }
      : {})
  };
  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: query.limit
  });

  await auditExport(user, "audit", { rows: logs.length, q: query.q });

  return toCsv(
    ["id", "usuario_id", "email", "acao", "entidade", "entidade_id", "ip", "metadata", "criado_em"],
    logs.map((log) => [
      log.id,
      log.userId,
      log.userEmail,
      log.action,
      log.entityType,
      log.entityId,
      log.ip,
      log.metadata ? JSON.stringify(log.metadata) : "",
      log.createdAt
    ])
  );
}

export async function buildReport(user: User, query: ReportQuery) {
  if (query.type === "campaigns") {
    return buildCampaignsReport(user, query);
  }

  if (query.type === "failures") {
    return buildFailuresReport(user, query);
  }

  if (query.type === "access") {
    return buildAccessReport(user, query);
  }

  return buildAuditReport(user, query);
}
