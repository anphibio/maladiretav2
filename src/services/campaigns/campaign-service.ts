import { AuditAction, type CampaignStatus, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";
import { registerAuditLog } from "@/services/audit/audit-service";
import type { CreateCampaignInput, UpdateCampaignInput } from "@/features/campaigns/schemas";

const reconcileStatuses: CampaignStatus[] = ["QUEUED", "SENDING", "COMPLETED"];

export async function reconcileCampaignDeliveryStatus(campaignId: string): Promise<CampaignStatus | null> {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    select: {
      status: true
    }
  });

  if (!campaign) {
    return null;
  }

  if (!reconcileStatuses.includes(campaign.status)) {
    return campaign.status;
  }

  const [totalRecipients, pendingRecipients, failedRecipients, activeJobs] = await Promise.all([
    prisma.campaignRecipient.count({ where: { campaignId } }),
    prisma.campaignRecipient.count({ where: { campaignId, status: "PENDING" } }),
    prisma.campaignRecipient.count({ where: { campaignId, status: "FAILED" } }),
    prisma.emailJob.count({
      where: {
        campaignId,
        status: { in: ["WAITING", "ACTIVE", "RETRYING"] }
      }
    })
  ]);

  if (totalRecipients === 0 || pendingRecipients > 0 || activeJobs > 0) {
    return campaign.status;
  }

  const status: CampaignStatus = failedRecipients > 0 ? "FAILED" : "COMPLETED";
  const updated = await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      status,
      finishedAt: new Date()
    },
    select: {
      status: true
    }
  });

  return updated.status;
}

export async function listCampaignsForUser(user: User) {
  const campaigns = await prisma.campaign.findMany({
    where: user.role === "OPERATOR" ? { ownerUserId: user.id } : undefined,
    include: {
      _count: {
        select: {
          recipients: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 50
  });

  const campaignsToReconcile = campaigns.filter((campaign) => reconcileStatuses.includes(campaign.status));

  if (campaignsToReconcile.length === 0) {
    return campaigns;
  }

  await Promise.all(campaignsToReconcile.map((campaign) => reconcileCampaignDeliveryStatus(campaign.id)));

  return prisma.campaign.findMany({
    where: user.role === "OPERATOR" ? { ownerUserId: user.id } : undefined,
    include: {
      _count: {
        select: {
          recipients: true
        }
      }
    },
    orderBy: {
      createdAt: "desc"
    },
    take: 50
  });
}

export async function getCampaignForUser(campaignId: string, user: User) {
  await reconcileCampaignDeliveryStatus(campaignId);

  return prisma.campaign.findFirst({
    where: {
      id: campaignId,
      ...(user.role === "OPERATOR" ? { ownerUserId: user.id } : {})
    },
    include: {
      owner: true,
      recipients: {
        orderBy: {
          createdAt: "desc"
        },
        take: 25
      },
      importBatches: {
        include: {
          _count: {
            select: {
              errors: true
            }
          }
        },
        orderBy: {
          createdAt: "desc"
        },
        take: 10
      },
      attachments: {
        orderBy: {
          createdAt: "desc"
        }
      },
      _count: {
        select: {
          recipients: true,
          emailJobs: true,
          emailLogs: true
        }
      }
    }
  });
}

export async function createDraftCampaign(input: CreateCampaignInput, user: User) {
  const campaign = await prisma.campaign.create({
    data: {
      name: input.name,
      subject: input.subject,
      htmlBody: input.htmlBody,
      textBody: input.textBody,
      senderEmail: user.email,
      ownerUserId: user.id,
      status: input.scheduledAt ? "SCHEDULED" : "DRAFT",
      scheduledAt: input.scheduledAt
    }
  });

  await registerAuditLog({
    userId: user.id,
    userEmail: user.email,
    action: AuditAction.CAMPAIGN_CREATED,
    entityType: "campaign",
    entityId: campaign.id,
    metadata: {
      campaignName: campaign.name,
      senderEmail: campaign.senderEmail,
      scheduledAt: campaign.scheduledAt
    }
  });

  return campaign;
}

export async function updateDraftCampaign(input: {
  campaignId: string;
  data: UpdateCampaignInput;
  user: User;
}) {
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: input.campaignId,
      ...(input.user.role === "OPERATOR" ? { ownerUserId: input.user.id } : {})
    }
  });

  if (!campaign) {
    throw new Error("Campanha não encontrada ou sem permissão.");
  }

  if (campaign.status !== "DRAFT") {
    throw new Error("Somente campanhas em rascunho podem ser editadas.");
  }

  const { bodyMode: _bodyMode, ...campaignData } = input.data;
  void _bodyMode;
  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: campaignData
  });

  await registerAuditLog({
    userId: input.user.id,
    userEmail: input.user.email,
    action: AuditAction.CAMPAIGN_UPDATED,
    entityType: "campaign",
    entityId: campaign.id,
    metadata: {
      changedFields: Object.keys(input.data)
    }
  });

  return updated;
}

export async function pauseCampaign(input: { campaignId: string; user: User }) {
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: input.campaignId,
      ...(input.user.role === "OPERATOR" ? { ownerUserId: input.user.id } : {})
    }
  });

  if (!campaign) {
    throw new Error("Campanha não encontrada ou sem permissão.");
  }

  if (campaign.status !== "QUEUED" && campaign.status !== "SENDING") {
    throw new Error("Apenas campanhas em fila ou enviando podem ser pausadas.");
  }

  const updated = await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "PAUSED" }
  });

  await prisma.emailJob.updateMany({
    where: {
      campaignId: campaign.id,
      status: "WAITING"
    },
    data: {
      status: "CANCELED",
      lastError: "Campanha pausada pelo usuário."
    }
  });

  await registerAuditLog({
    userId: input.user.id,
    userEmail: input.user.email,
    action: AuditAction.CAMPAIGN_PAUSED,
    entityType: "campaign",
    entityId: campaign.id
  });

  return updated;
}

export async function cancelCampaign(input: { campaignId: string; user: User }) {
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: input.campaignId,
      ...(input.user.role === "OPERATOR" ? { ownerUserId: input.user.id } : {})
    }
  });

  if (!campaign) {
    throw new Error("Campanha não encontrada ou sem permissão.");
  }

  if (campaign.status === "COMPLETED" || campaign.status === "CANCELED") {
    throw new Error("Campanha já finalizada.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const canceledCampaign = await tx.campaign.update({
      where: { id: campaign.id },
      data: {
        status: "CANCELED",
        finishedAt: new Date()
      }
    });

    await tx.emailJob.updateMany({
      where: {
        campaignId: campaign.id,
        status: { in: ["WAITING", "ACTIVE", "RETRYING"] }
      },
      data: {
        status: "CANCELED",
        lastError: "Campanha cancelada pelo usuário."
      }
    });

    await tx.campaignRecipient.updateMany({
      where: {
        campaignId: campaign.id,
        status: "PENDING"
      },
      data: {
        status: "CANCELED"
      }
    });

    return canceledCampaign;
  });

  await registerAuditLog({
    userId: input.user.id,
    userEmail: input.user.email,
    action: AuditAction.CAMPAIGN_CANCELED,
    entityType: "campaign",
    entityId: campaign.id
  });

  return updated;
}

export async function resetFailedRecipients(input: { campaignId: string; user: User }) {
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: input.campaignId,
      ...(input.user.role === "OPERATOR" ? { ownerUserId: input.user.id } : {})
    }
  });

  if (!campaign) {
    throw new Error("Campanha não encontrada ou sem permissão.");
  }

  if (campaign.status === "CANCELED") {
    throw new Error("Campanha cancelada não pode reenviar falhas.");
  }

  const updated = await prisma.campaignRecipient.updateMany({
    where: {
      campaignId: campaign.id,
      status: "FAILED"
    },
    data: {
      status: "PENDING",
      errorMessage: null
    }
  });

  if (updated.count === 0) {
    throw new Error("Nenhuma falha encontrada para reenvio.");
  }

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: "PAUSED" }
  });

  await registerAuditLog({
    userId: input.user.id,
    userEmail: input.user.email,
    action: AuditAction.CAMPAIGN_UPDATED,
    entityType: "campaign",
    entityId: campaign.id,
    metadata: {
      kind: "retry_failures",
      recipientsReset: updated.count
    }
  });

  return updated.count;
}

export async function updateFailedRecipientEmail(input: {
  campaignId: string;
  recipientId: string;
  email: string;
  user: User;
}) {
  const normalizedEmail = input.email.trim().toLowerCase();
  const domain = normalizedEmail.split("@")[1]?.toLowerCase();

  if (!domain) {
    throw new Error("E-mail inválido.");
  }

  const recipient = await prisma.campaignRecipient.findFirst({
    where: {
      id: input.recipientId,
      campaignId: input.campaignId,
      status: "FAILED",
      campaign: {
        ...(input.user.role === "OPERATOR" ? { ownerUserId: input.user.id } : {})
      }
    },
    include: {
      campaign: true
    }
  });

  if (!recipient) {
    throw new Error("Destinatário com falha não encontrado ou sem permissão.");
  }

  const duplicate = await prisma.campaignRecipient.findFirst({
    where: {
      campaignId: input.campaignId,
      email: normalizedEmail,
      id: { not: recipient.id }
    }
  });

  if (duplicate) {
    throw new Error("Já existe outro destinatário com esse e-mail nesta campanha.");
  }

  const updated = await prisma.campaignRecipient.update({
    where: { id: recipient.id },
    data: {
      email: normalizedEmail,
      domain,
      errorMessage: null
    }
  });

  await registerAuditLog({
    userId: input.user.id,
    userEmail: input.user.email,
    action: AuditAction.CAMPAIGN_UPDATED,
    entityType: "campaign_recipient",
    entityId: recipient.id,
    metadata: {
      kind: "failed_recipient_email_updated",
      campaignId: input.campaignId,
      previousEmail: recipient.email,
      nextEmail: normalizedEmail
    }
  });

  return updated;
}

export function getCampaignStatusLabel(status: CampaignStatus): string {
  const labels: Record<CampaignStatus, string> = {
    DRAFT: "Rascunho",
    SCHEDULED: "Agendado",
    QUEUED: "Em fila",
    SENDING: "Enviando",
    SENT: "Enviado",
    FAILED: "Falhou",
    PAUSED: "Pausado",
    CANCELED: "Cancelado",
    COMPLETED: "Concluído"
  };

  return labels[status];
}
