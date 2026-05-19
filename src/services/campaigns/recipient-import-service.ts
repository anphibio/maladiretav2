import { AuditAction, type Prisma, type User } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";
import { getEmailDomain, parseRecipientFile, type ParsedRecipientImport } from "@/services/email/recipient-import";
import { registerAuditLog } from "@/services/audit/audit-service";

function toPrismaJson(value: Record<string, unknown>): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function importRecipientsToCampaign(input: {
  campaignId: string;
  file: File;
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

  if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") {
    throw new Error("Destinatários só podem ser importados em campanhas em rascunho ou agendadas.");
  }

  const parsed = await parseRecipientFile(input.file);

  return importParsedRecipientsToCampaign({
    campaignId: input.campaignId,
    filename: input.file.name,
    parsed,
    user: input.user
  });
}

export async function importParsedRecipientsToCampaign(input: {
  campaignId: string;
  filename: string;
  parsed: ParsedRecipientImport;
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

  if (campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED") {
    throw new Error("Destinatários só podem ser importados em campanhas em rascunho ou agendadas.");
  }

  const batch = await prisma.$transaction(async (tx) => {
    const importBatch = await tx.importBatch.create({
      data: {
        campaignId: campaign.id,
        filename: input.filename,
        totalRows: input.parsed.totalRows,
        validRows: input.parsed.validRows.length,
        invalidRows: input.parsed.errors.length,
        duplicatesRemoved: input.parsed.duplicatesRemoved
      }
    });

    if (input.parsed.validRows.length > 0) {
      await tx.campaignRecipient.createMany({
        data: input.parsed.validRows.map((recipient) => ({
          campaignId: campaign.id,
          email: recipient.email,
          name: recipient.nome,
          cpf: recipient.cpf,
          setor: recipient.setor,
          cargo: recipient.cargo,
          orgao: recipient.orgao,
          cidade: recipient.cidade,
          estado: recipient.estado,
          tags: recipient.tags
            ? recipient.tags
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean)
            : [],
          domain: getEmailDomain(recipient.email)
        })),
        skipDuplicates: true
      });
    }

    if (input.parsed.errors.length > 0) {
      await tx.importError.createMany({
        data: input.parsed.errors.map((error) => ({
          importBatchId: importBatch.id,
          rowNumber: error.rowNumber,
          email: error.email,
          reason: error.reason,
          rawData: toPrismaJson(error.rawData)
        }))
      });
    }

    return importBatch;
  });

  await registerAuditLog({
    userId: input.user.id,
    userEmail: input.user.email,
    action: AuditAction.RECIPIENTS_IMPORTED,
    entityType: "campaign",
    entityId: campaign.id,
    metadata: {
      filename: input.filename,
      totalRows: input.parsed.totalRows,
      validRows: input.parsed.validRows.length,
      invalidRows: input.parsed.errors.length,
      duplicatesRemoved: input.parsed.duplicatesRemoved
    }
  });

  return {
    batch,
    summary: {
      totalRows: input.parsed.totalRows,
      validRows: input.parsed.validRows.length,
      invalidRows: input.parsed.errors.length,
      duplicatesRemoved: input.parsed.duplicatesRemoved
    }
  };
}
