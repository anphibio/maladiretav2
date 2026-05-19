import { AuditAction, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";
import { registerAuditLog } from "@/services/audit/audit-service";

export async function addCampaignAttachments(input: {
  campaignId: string;
  files: File[];
  user: User;
}) {
  if (input.files.length === 0) {
    return [];
  }

  const campaign = await prisma.campaign.findFirst({
    where: {
      id: input.campaignId,
      ...(input.user.role === "OPERATOR" ? { ownerUserId: input.user.id } : {})
    }
  });

  if (!campaign) {
    throw new Error("Campanha não encontrada ou sem permissão.");
  }

  if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") {
    throw new Error("Anexos só podem ser alterados em campanhas em rascunho ou agendadas.");
  }

  const attachments = [];

  for (const file of input.files) {
    if (file.size === 0) {
      continue;
    }

    const attachment = await prisma.campaignAttachment.create({
      data: {
        campaignId: campaign.id,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        content: Buffer.from(await file.arrayBuffer())
      }
    });

    attachments.push(attachment);
  }

  await registerAuditLog({
    userId: input.user.id,
    userEmail: input.user.email,
    action: AuditAction.CAMPAIGN_UPDATED,
    entityType: "campaign",
    entityId: campaign.id,
    metadata: {
      kind: "attachments_added",
      count: attachments.length
    }
  });

  return attachments;
}
