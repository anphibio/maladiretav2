import { NextRequest, NextResponse } from "next/server";
import { updateCampaignSchema } from "@/features/campaigns/schemas";
import { requireCurrentUserForApi } from "@/lib/auth/current-user";
import { getCampaignForUser, updateDraftCampaign } from "@/services/campaigns/campaign-service";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireCurrentUserForApi();

  if (!user) {
    return response;
  }

  const { id } = await context.params;
  const campaign = await getCampaignForUser(id, user);

  if (!campaign) {
    return NextResponse.json({ message: "Campanha não encontrada." }, { status: 404 });
  }

  return NextResponse.json({
    campaign: {
      id: campaign.id,
      status: campaign.status,
      recipients: campaign.recipients.map((recipient) => ({
        id: recipient.id,
        email: recipient.email,
        name: recipient.name,
        domain: recipient.domain,
        status: recipient.status,
        errorMessage: recipient.errorMessage,
        sentAt: recipient.sentAt
      }))
    }
  });
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireCurrentUserForApi();

  if (!user) {
    return response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updateCampaignSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Dados da campanha inválidos." },
      { status: 400 }
    );
  }

  try {
    const campaign = await updateDraftCampaign({
      campaignId: id,
      data: parsed.data,
      user
    });

    return NextResponse.json({ campaign });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Não foi possível atualizar a campanha." },
      { status: 400 }
    );
  }
}
