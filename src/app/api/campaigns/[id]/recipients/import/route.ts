import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUserForApi } from "@/lib/auth/current-user";
import { importRecipientsToCampaign } from "@/services/campaigns/recipient-import-service";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireCurrentUserForApi();

  if (!user) {
    return response;
  }

  const { id } = await context.params;
  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ message: "Envie um arquivo CSV ou XLSX." }, { status: 400 });
  }

  try {
    const result = await importRecipientsToCampaign({
      campaignId: id,
      file,
      user
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Não foi possível importar destinatários." },
      { status: 400 }
    );
  }
}
