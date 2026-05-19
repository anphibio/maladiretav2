import { NextRequest, NextResponse } from "next/server";
import { createCampaignSchema } from "@/features/campaigns/schemas";
import { requireCurrentUserForApi } from "@/lib/auth/current-user";
import { createDraftCampaign, listCampaignsForUser } from "@/services/campaigns/campaign-service";
import { addCampaignAttachments } from "@/services/campaigns/attachment-service";
import { importParsedRecipientsToCampaign } from "@/services/campaigns/recipient-import-service";
import { prepareCampaignQueue } from "@/services/campaigns/campaign-send-service";
import { parseRecipientFile, parseRecipientText } from "@/services/email/recipient-import";

export async function GET() {
  const { user, response } = await requireCurrentUserForApi();

  if (!user) {
    return response;
  }

  const campaigns = await listCampaignsForUser(user);

  return NextResponse.json({
    campaigns: campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      subject: campaign.subject,
      senderEmail: campaign.senderEmail,
      status: campaign.status,
      recipients: campaign._count.recipients,
      scheduledAt: campaign.scheduledAt,
      createdAt: campaign.createdAt
    }))
  });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireCurrentUserForApi();

  if (!user) {
    return response;
  }

  const contentType = request.headers.get("content-type") ?? "";
  const formData = contentType.includes("multipart/form-data") ? await request.formData() : null;
  const body =
    formData === null
      ? await request.json().catch(() => null)
      : {
          name: String(formData.get("name") ?? ""),
          subject: String(formData.get("subject") ?? ""),
          htmlBody: String(formData.get("htmlBody") ?? ""),
          textBody: String(formData.get("textBody") ?? ""),
          bodyMode: String(formData.get("bodyMode") ?? "html"),
          scheduledAt: formData.get("scheduledAt") ? String(formData.get("scheduledAt")) : undefined
        };
  const parsed = createCampaignSchema.safeParse(body);
  const intent = formData ? String(formData.get("intent") ?? "draft") : "draft";

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Dados da campanha inválidos." },
      { status: 400 }
    );
  }

  if (intent === "schedule" && !parsed.data.scheduledAt) {
    return NextResponse.json({ message: "Informe a data e hora do agendamento." }, { status: 400 });
  }

  if (intent === "schedule" && parsed.data.scheduledAt && parsed.data.scheduledAt <= new Date()) {
    return NextResponse.json({ message: "A data do agendamento precisa ser futura." }, { status: 400 });
  }

  try {
    const campaign = await createDraftCampaign(parsed.data, user);

    if (formData) {
      const recipientMode = String(formData.get("recipientMode") ?? "csv");
      const recipientFile = formData.get("recipientFile");
      const manualRecipients = String(formData.get("manualRecipients") ?? "");

      if ((recipientMode === "csv" || recipientMode === "txt") && recipientFile instanceof File && recipientFile.size > 0) {
        const parsedRecipients = await parseRecipientFile(recipientFile);
        await importParsedRecipientsToCampaign({
          campaignId: campaign.id,
          filename: recipientFile.name,
          parsed: parsedRecipients,
          user
        });
      }

      if (recipientMode === "manual" && manualRecipients.trim()) {
        await importParsedRecipientsToCampaign({
          campaignId: campaign.id,
          filename: "destinatarios-informados.txt",
          parsed: parseRecipientText(manualRecipients),
          user
        });
      }

      const attachments = formData
        .getAll("attachments")
        .filter((file): file is File => file instanceof File && file.size > 0);

      await addCampaignAttachments({
        campaignId: campaign.id,
        files: attachments,
        user
      });

      if (intent === "send") {
        const queueResult = await prepareCampaignQueue({
          campaignId: campaign.id,
          user,
          payload: {
            password: String(formData.get("queuePassword") ?? "") || undefined
          }
        });

        return NextResponse.json(
          {
            campaign: {
              id: campaign.id,
              name: campaign.name,
              subject: campaign.subject,
              senderEmail: campaign.senderEmail,
              status: "QUEUED",
              scheduledAt: campaign.scheduledAt,
              createdAt: campaign.createdAt
            },
            queue: queueResult
          },
          { status: 201 }
        );
      }
    }

    return NextResponse.json(
      {
        campaign: {
          id: campaign.id,
          name: campaign.name,
          subject: campaign.subject,
          senderEmail: campaign.senderEmail,
          status: campaign.status,
          scheduledAt: campaign.scheduledAt,
          createdAt: campaign.createdAt
        }
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        message: error instanceof Error ? error.message : "Não foi possível criar a campanha."
      },
      { status: 400 }
    );
  }
}
