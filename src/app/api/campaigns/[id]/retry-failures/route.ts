import { NextResponse } from "next/server";
import { requireCurrentUserForApi } from "@/lib/auth/current-user";
import { resetFailedRecipients } from "@/services/campaigns/campaign-service";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireCurrentUserForApi();

  if (!user) {
    return response;
  }

  const { id } = await context.params;

  try {
    const recipientsReset = await resetFailedRecipients({ campaignId: id, user });
    return NextResponse.json({ recipientsReset });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Não foi possível reenviar falhas." },
      { status: 400 }
    );
  }
}
