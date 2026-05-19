import { NextRequest, NextResponse } from "next/server";
import { domainRateLimitSchema } from "@/features/admin/schemas";
import { requireAdminForApi } from "@/lib/auth/current-user";
import { listDomainRateLimits, upsertDomainRateLimit } from "@/services/admin/domain-rate-limit-service";

export async function GET() {
  const { user, response } = await requireAdminForApi();

  if (!user) {
    return response;
  }

  const limits = await listDomainRateLimits();

  return NextResponse.json({ limits });
}

export async function POST(request: NextRequest) {
  const { user, response } = await requireAdminForApi();

  if (!user) {
    return response;
  }

  const body = await request.json().catch(() => null);
  const parsed = domainRateLimitSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Dados do domínio inválidos." },
      { status: 400 }
    );
  }

  const limit = await upsertDomainRateLimit(parsed.data, user);

  return NextResponse.json({ limit }, { status: 201 });
}
