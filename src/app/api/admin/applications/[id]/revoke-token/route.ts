import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminForApi } from "@/lib/auth/current-user";
import { revokeApplicationToken } from "@/services/api-email/api-application-service";

const revokeTokenSchema = z.object({
  tokenId: z.string().min(1)
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAdminForApi();

  if (!user) {
    return response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = revokeTokenSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ message: "Token inválido." }, { status: 400 });
  }

  try {
    const token = await revokeApplicationToken({
      applicationId: id,
      tokenId: parsed.data.tokenId,
      user
    });

    return NextResponse.json({ token });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Não foi possível revogar o token." },
      { status: 400 }
    );
  }
}
