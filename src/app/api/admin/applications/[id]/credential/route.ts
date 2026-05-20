import { NextResponse } from "next/server";
import { applicationCredentialSchema } from "@/features/api-email/admin-schemas";
import { requireAdminForApi } from "@/lib/auth/current-user";
import { storeApplicationCredential } from "@/services/api-email/api-application-service";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAdminForApi();

  if (!user) {
    return response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = applicationCredentialSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Dados da credencial inválidos." },
      { status: 400 }
    );
  }

  try {
    const application = await storeApplicationCredential({
      applicationId: id,
      password: parsed.data.password,
      user
    });

    return NextResponse.json({ application });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Não foi possível salvar a credencial." },
      { status: 400 }
    );
  }
}
