import { AuditAction, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";
import { registerAuditLog } from "@/services/audit/audit-service";
import type { DomainRateLimitInput } from "@/features/admin/schemas";

const defaultSensitiveDomains = [
  { domain: "outlook.com", messagesPerMinute: 1, delayMs: 60000, active: true },
  { domain: "hotmail.com", messagesPerMinute: 1, delayMs: 60000, active: true },
  { domain: "live.com", messagesPerMinute: 1, delayMs: 60000, active: true },
  { domain: "msn.com", messagesPerMinute: 1, delayMs: 60000, active: true }
];

export async function ensureDefaultDomainRateLimits() {
  for (const limit of defaultSensitiveDomains) {
    await prisma.domainRateLimit.upsert({
      where: { domain: limit.domain },
      update: {},
      create: limit
    });
  }
}

export async function listDomainRateLimits() {
  await ensureDefaultDomainRateLimits();

  return prisma.domainRateLimit.findMany({
    orderBy: [{ active: "desc" }, { domain: "asc" }]
  });
}

export async function upsertDomainRateLimit(input: DomainRateLimitInput, user: User) {
  const limit = await prisma.domainRateLimit.upsert({
    where: { domain: input.domain },
    update: {
      messagesPerMinute: input.messagesPerMinute,
      delayMs: input.delayMs,
      active: input.active
    },
    create: input
  });

  await registerAuditLog({
    userId: user.id,
    userEmail: user.email,
    action: AuditAction.ADMIN_CHANGED,
    entityType: "domain_rate_limit",
    entityId: limit.id,
    metadata: {
      domain: limit.domain,
      messagesPerMinute: limit.messagesPerMinute,
      delayMs: limit.delayMs,
      active: limit.active
    }
  });

  return limit;
}
