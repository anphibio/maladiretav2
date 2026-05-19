import { NextResponse } from "next/server";
import { queueCampaignSchema } from "@/features/campaigns/send-schemas";
import { requireCurrentUserForApi } from "@/lib/auth/current-user";
import { prepareCampaignQueue } from "@/services/campaigns/campaign-send-service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireCurrentUserForApi();

  if (!user) {
    return response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => ({}));
  const parsed = queueCampaignSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Dados da fila inválidos." }, { status: 400 });
  }

  try {
    const result = await prepareCampaignQueue({
      campaignId: id,
      user,
      payload: parsed.data
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Não foi possível preparar a fila." },
      { status: 400 }
    );
  }
}
