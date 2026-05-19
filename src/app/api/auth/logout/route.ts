import { NextRequest, NextResponse } from "next/server";
import { AuditAction } from "@prisma/client";
import { clearSessionCookie, getCurrentSession } from "@/lib/auth/session";
import { registerAccessLog, registerAuditLog } from "@/services/audit/audit-service";

function getClientIp(request: NextRequest): string | undefined {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? undefined;
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  const ip = getClientIp(request);
  const userAgent = request.headers.get("user-agent") ?? undefined;

  if (session) {
    await registerAccessLog({
      userId: session.userId,
      email: session.email,
      action: "LOGOUT",
      ip,
      userAgent,
      success: true
    });

    await registerAuditLog({
      userId: session.userId,
      userEmail: session.email,
      action: AuditAction.LOGOUT,
      ip,
      userAgent
    });
  }

  await clearSessionCookie();

  return NextResponse.json({ ok: true, redirectTo: "/login" });
}
