import { NextResponse } from "next/server";
import { applicationSchema } from "@/features/api-email/admin-schemas";
import { requireAdminForApi } from "@/lib/auth/current-user";
import { upsertApplication } from "@/services/api-email/api-application-service";

export async function POST(request: Request) {
  const { user, response } = await requireAdminForApi();

  if (!user) {
    return response;
  }

  const body = await request.json().catch(() => null);
  const parsed = applicationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Dados da aplicação inválidos." },
      { status: 400 }
    );
  }

  try {
    const application = await upsertApplication({
      ...parsed.data,
      user
    });

    return NextResponse.json({ application });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Não foi possível salvar a aplicação." },
      { status: 400 }
    );
  }
}
