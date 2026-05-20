import { AuditAction, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";
import { generateApiToken } from "@/lib/security/api-token";
import { decryptSecret, encryptSecret } from "@/lib/security/credential-encryption";
import { registerAuditLog } from "@/services/audit/audit-service";
import { validateZimbraCredentials } from "@/services/zimbra/zimbra-service";

export async function listApplicationsForAdmin() {
  return prisma.application.findMany({
    include: {
      tokens: {
        orderBy: {
          createdAt: "desc"
        }
      },
      _count: {
        select: {
          emailTasks: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    }
  });
}

export async function upsertApplication(input: {
  id?: string;
  name: string;
  description?: string;
  senderEmail: string;
  isActive: boolean;
  user: User;
}) {
  const data = {
    name: input.name.trim(),
    description: input.description?.trim() || null,
    senderEmail: input.senderEmail.trim().toLowerCase(),
    isActive: input.isActive
  };
  const application = input.id
    ? await prisma.application.update({
        where: { id: input.id },
        data
      })
    : await prisma.application.create({
        data
      });

  await registerAuditLog({
    userId: input.user.id,
    userEmail: input.user.email,
    action: AuditAction.ADMIN_CHANGED,
    entityType: "application",
    entityId: application.id,
    metadata: {
      name: application.name,
      senderEmail: application.senderEmail,
      isActive: application.isActive
    }
  });

  return application;
}

export async function storeApplicationCredential(input: {
  applicationId: string;
  password: string;
  user: User;
}) {
  const application = await prisma.application.findUnique({
    where: { id: input.applicationId }
  });

  if (!application) {
    throw new Error("Aplicação não encontrada.");
  }

  await validateZimbraCredentials({
    email: application.senderEmail,
    password: input.password
  });

  const updated = await prisma.application.update({
    where: { id: application.id },
    data: {
      encryptedPassword: encryptSecret(input.password)
    }
  });

  await registerAuditLog({
    userId: input.user.id,
    userEmail: input.user.email,
    action: AuditAction.ADMIN_CHANGED,
    entityType: "application",
    entityId: application.id,
    metadata: {
      kind: "application_credential_updated",
      senderEmail: application.senderEmail
    }
  });

  return updated;
}

export function decryptApplicationCredential(application: { encryptedPassword: string | null }) {
  if (!application.encryptedPassword) {
    return null;
  }

  try {
    return decryptSecret(application.encryptedPassword);
  } catch {
    throw new Error("A credencial protegida da aplicação não pôde ser aberta. Salve novamente a senha do remetente.");
  }
}

export async function createApplicationToken(input: { applicationId: string; user: User }) {
  const application = await prisma.application.findUnique({
    where: { id: input.applicationId }
  });

  if (!application) {
    throw new Error("Aplicação não encontrada.");
  }

  const generated = generateApiToken();
  const token = await prisma.apiToken.create({
    data: {
      applicationId: application.id,
      tokenHash: generated.tokenHash,
      tokenPrefix: generated.tokenPrefix
    }
  });

  await registerAuditLog({
    userId: input.user.id,
    userEmail: input.user.email,
    action: AuditAction.ADMIN_CHANGED,
    entityType: "api_token",
    entityId: token.id,
    metadata: {
      kind: "application_token_created",
      applicationId: application.id,
      tokenPrefix: token.tokenPrefix
    }
  });

  return {
    token,
    plainToken: generated.token
  };
}

export async function revokeApplicationToken(input: {
  applicationId: string;
  tokenId: string;
  user: User;
}) {
  const token = await prisma.apiToken.findFirst({
    where: {
      id: input.tokenId,
      applicationId: input.applicationId,
      revokedAt: null
    }
  });

  if (!token) {
    throw new Error("Token ativo não encontrado.");
  }

  const updated = await prisma.apiToken.update({
    where: { id: token.id },
    data: { revokedAt: new Date() }
  });

  await registerAuditLog({
    userId: input.user.id,
    userEmail: input.user.email,
    action: AuditAction.ADMIN_CHANGED,
    entityType: "api_token",
    entityId: token.id,
    metadata: {
      kind: "application_token_revoked",
      applicationId: input.applicationId,
      tokenPrefix: token.tokenPrefix
    }
  });

  return updated;
}
