import { NextRequest, NextResponse } from "next/server";
import { AuditAction } from "@prisma/client";
import { isBootstrapAdminEmail } from "@/config/env";
import { buildInstitutionalEmail, loginSchema } from "@/features/auth/schemas";
import { setSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma/client";
import { checkMemoryRateLimit } from "@/lib/security/rate-limit";
import { registerAccessLog, registerAuditLog } from "@/services/audit/audit-service";
import { storeTemporaryLoginCredential } from "@/services/zimbra/credential-vault";
import { validateZimbraCredentials } from "@/services/zimbra/zimbra-service";

function getClientIp(request: NextRequest): string | undefined {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? undefined;
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? undefined;
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Dados de login inválidos." },
      { status: 400 }
    );
  }

  const email = buildInstitutionalEmail(parsed.data.username);
  const rateLimitKey = `login:${ip ?? "unknown"}:${email}`;

  if (!checkMemoryRateLimit(rateLimitKey, 5, 10 * 60 * 1000)) {
    await registerAccessLog({
      email,
      action: "LOGIN_RATE_LIMITED",
      ip,
      userAgent,
      success: false
    });

    return NextResponse.json(
      { message: "Muitas tentativas de acesso. Aguarde alguns minutos e tente novamente." },
      { status: 429 }
    );
  }

  try {
    await validateZimbraCredentials({
      email,
      password: parsed.data.password
    });

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        active: true,
        role: isBootstrapAdminEmail(email) ? "ADMIN" : undefined,
        lastLoginAt: new Date()
      },
      create: {
        email,
        name: parsed.data.username,
        role: isBootstrapAdminEmail(email) ? "ADMIN" : "OPERATOR",
        active: true,
        lastLoginAt: new Date()
      }
    });

    await registerAccessLog({
      userId: user.id,
      email,
      action: "LOGIN_SUCCESS",
      ip,
      userAgent,
      success: true
    });

    await registerAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: AuditAction.LOGIN_SUCCESS,
      ip,
      userAgent
    });

    await storeTemporaryLoginCredential({
      email: user.email,
      password: parsed.data.password
    });

    await setSessionCookie({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    return NextResponse.json({
      ok: true,
      redirectTo: "/dashboard"
    });
  } catch {
    await registerAccessLog({
      email,
      action: "LOGIN_FAILURE",
      ip,
      userAgent,
      success: false
    });

    await registerAuditLog({
      userEmail: email,
      action: AuditAction.LOGIN_FAILURE,
      ip,
      userAgent
    });

    return NextResponse.json(
      { message: "Usuário ou senha do Zimbra inválidos, ou serviço indisponível." },
      { status: 401 }
    );
  }
}
