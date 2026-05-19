import { NextResponse } from "next/server";
import { requireCurrentUserForApi } from "@/lib/auth/current-user";
import { pauseCampaign } from "@/services/campaigns/campaign-service";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireCurrentUserForApi();

  if (!user) {
    return response;
  }

  const { id } = await context.params;

  try {
    const campaign = await pauseCampaign({ campaignId: id, user });
    return NextResponse.json({ campaign });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Não foi possível pausar a campanha." },
      { status: 400 }
    );
  }
}
