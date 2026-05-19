import { NextRequest, NextResponse } from "next/server";
import { sendTestSchema } from "@/features/campaigns/send-schemas";
import { requireCurrentUserForApi } from "@/lib/auth/current-user";
import { sendCampaignTest } from "@/services/campaigns/campaign-send-service";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireCurrentUserForApi();

  if (!user) {
    return response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = sendTestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Dados do teste inválidos." },
      { status: 400 }
    );
  }

  try {
    await sendCampaignTest({
      campaignId: id,
      user,
      payload: parsed.data
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Não foi possível enviar o teste." },
      { status: 400 }
    );
  }
}
