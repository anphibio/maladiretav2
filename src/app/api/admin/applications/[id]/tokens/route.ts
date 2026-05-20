import { NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth/current-user";
import { createApplicationToken } from "@/services/api-email/api-application-service";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAdminForApi();

  if (!user) {
    return response;
  }

  const { id } = await context.params;

  try {
    const result = await createApplicationToken({
      applicationId: id,
      user
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Não foi possível gerar o token." },
      { status: 400 }
    );
  }
}
