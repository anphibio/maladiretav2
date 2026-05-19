import { NextRequest, NextResponse } from "next/server";
import { systemSettingsSchema } from "@/features/settings/schemas";
import { requireAdminForApi, requireCurrentUserForApi } from "@/lib/auth/current-user";
import { getSystemSettings, updateSystemSettings } from "@/services/settings/settings-service";

export async function GET() {
  const { user, response } = await requireCurrentUserForApi();

  if (!user) {
    return response;
  }

  const settings = await getSystemSettings();

  return NextResponse.json({ settings });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAdminForApi();

  if (!user) {
    return response;
  }

  const body = await request.json().catch(() => null);
  const parsed = systemSettingsSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Configurações inválidas." },
      { status: 400 }
    );
  }

  const settings = await updateSystemSettings(parsed.data, user);

  return NextResponse.json({ settings });
}
