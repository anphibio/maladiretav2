import { NextRequest, NextResponse } from "next/server";
import { adminUserUpdateSchema } from "@/features/admin/schemas";
import { requireAdminForApi } from "@/lib/auth/current-user";
import { updateManagedUser } from "@/services/admin/user-admin-service";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { user, response } = await requireAdminForApi();

  if (!user) {
    return response;
  }

  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  const parsed = adminUserUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Dados do usuário inválidos." },
      { status: 400 }
    );
  }

  try {
    const updated = await updateManagedUser({
      targetUserId: id,
      data: parsed.data,
      admin: user
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Não foi possível atualizar o usuário." },
      { status: 400 }
    );
  }
}
