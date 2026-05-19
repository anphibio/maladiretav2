import type { AuditAction, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";

type AuditInput = {
  userId?: string;
  userEmail?: string;
  action: AuditAction;
  entityType?: string;
  entityId?: string;
  ip?: string;
  userAgent?: string;
  metadata?: Prisma.InputJsonValue;
};

export async function registerAuditLog(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      userId: input.userId,
      userEmail: input.userEmail,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      ip: input.ip,
      userAgent: input.userAgent,
      metadata: input.metadata
    }
  });
}

export async function registerAccessLog(input: {
  userId?: string;
  email: string;
  action: string;
  ip?: string;
  userAgent?: string;
  success: boolean;
}): Promise<void> {
  await prisma.accessLog.create({ data: input });
}
