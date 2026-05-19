import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCurrentUserForApi } from "@/lib/auth/current-user";
import { updateFailedRecipientEmail } from "@/services/campaigns/campaign-service";

const updateRecipientSchema = z.object({
  email: z.string().email("Informe um e-mail válido.")
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string; recipientId: string }> }) {
  const { user, response } = await requireCurrentUserForApi();

  if (!user) {
    return response;
  }

  const { id, recipientId } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = updateRecipientSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Dados do destinatário inválidos." },
      { status: 400 }
    );
  }

  try {
    const recipient = await updateFailedRecipientEmail({
      campaignId: id,
      recipientId,
      email: parsed.data.email,
      user
    });

    return NextResponse.json({ recipient });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Não foi possível atualizar o destinatário." },
      { status: 400 }
    );
  }
}
