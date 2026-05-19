import { NextResponse } from "next/server";
import { requireCurrentUserForApi } from "@/lib/auth/current-user";
import { resetFailedRecipients } from "@/services/campaigns/campaign-service";
import { prepareCampaignQueue } from "@/services/campaigns/campaign-send-service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireCurrentUserForApi();

  if (!user) {
    return response;
  }

  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { password?: string };

  try {
    const recipientsReset = await resetFailedRecipients({ campaignId: id, user });
    const queue = await prepareCampaignQueue({
      campaignId: id,
      user,
      payload: {
        password: body.password
      }
    });

    return NextResponse.json({ recipientsReset, queue });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Não foi possível reenviar falhas." },
      { status: 400 }
    );
  }
}
