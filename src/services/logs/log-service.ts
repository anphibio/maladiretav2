import type { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";
import type { LogQuery } from "@/features/logs/schemas";

function canViewAll(user: User): boolean {
  return user.role === "ADMIN" || user.role === "AUDITOR";
}

export async function getLogSummary(user: User) {
  const scope = canViewAll(user);

  const [auditCount, accessCount, emailCount] = await Promise.all([
    prisma.auditLog.count({
      where: scope ? undefined : { userId: user.id }
    }),
    prisma.accessLog.count({
      where: scope ? undefined : { userId: user.id }
    }),
    prisma.emailLog.count({
      where: scope ? undefined : { senderEmail: user.email }
    })
  ]);

  return { auditCount, accessCount, emailCount };
}

export async function listAuditLogs(user: User, query: LogQuery) {
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

  return prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: query.limit
  });
}

export async function listAccessLogs(user: User, query: LogQuery) {
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

  return prisma.accessLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: query.limit
  });
}

export async function listEmailLogs(user: User, query: LogQuery) {
  const where: Prisma.EmailLogWhereInput = {
    ...(canViewAll(user) ? {} : { senderEmail: user.email }),
    ...(query.q
      ? {
          OR: [
            { recipientEmail: { contains: query.q, mode: "insensitive" } },
            { senderEmail: { contains: query.q, mode: "insensitive" } },
            { status: { contains: query.q, mode: "insensitive" } },
            { errorMessage: { contains: query.q, mode: "insensitive" } }
          ]
        }
      : {})
  };

  return prisma.emailLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: query.limit
  });
}

export async function listLogs(user: User, query: LogQuery) {
  if (query.type === "access") {
    return { type: query.type, items: await listAccessLogs(user, query) };
  }

  if (query.type === "email") {
    return { type: query.type, items: await listEmailLogs(user, query) };
  }

  return { type: query.type, items: await listAuditLogs(user, query) };
}
