import { AuditAction, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";
import { registerAuditLog } from "@/services/audit/audit-service";
import type { AdminUserUpdateInput } from "@/features/admin/schemas";

export async function listManagedUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      lastLoginAt: true,
      createdAt: true,
      _count: {
        select: {
          campaigns: true,
          auditLogs: true
        }
      }
    },
    orderBy: [{ active: "desc" }, { email: "asc" }]
  });
}

export async function updateManagedUser(input: {
  targetUserId: string;
  data: AdminUserUpdateInput;
  admin: User;
}) {
  if (input.targetUserId === input.admin.id && (!input.data.active || input.data.role !== "ADMIN")) {
    throw new Error("Você não pode remover seu próprio acesso administrativo.");
  }

  const target = await prisma.user.findUnique({
    where: { id: input.targetUserId }
  });

  if (!target) {
    throw new Error("Usuário não encontrado.");
  }

  const updated = await prisma.user.update({
    where: { id: input.targetUserId },
    data: {
      role: input.data.role,
      active: input.data.active
    }
  });

  await registerAuditLog({
    userId: input.admin.id,
    userEmail: input.admin.email,
    action: AuditAction.ADMIN_CHANGED,
    entityType: "user",
    entityId: updated.id,
    metadata: {
      targetEmail: updated.email,
      previousRole: target.role,
      nextRole: updated.role,
      previousActive: target.active,
      nextActive: updated.active
    }
  });

  return updated;
}
