import { NextResponse } from "next/server";
import type { Application } from "@prisma/client";
import { prisma } from "@/lib/prisma/client";
import { hashApiToken, safeTokenEquals } from "@/lib/security/api-token";

type ApiApplicationAuthResult =
  | { application: Application; response: null }
  | { application: null; response: NextResponse };

function unauthorized(message = "Token de aplicação inválido ou ausente.") {
  return NextResponse.json({ message }, { status: 401 });
}

export async function requireApiApplication(request: Request): Promise<ApiApplicationAuthResult> {
  const authorization = request.headers.get("authorization") ?? "";
  const [scheme, token] = authorization.split(/\s+/);

  if (scheme !== "AppToken" || !token) {
    return { application: null, response: unauthorized() };
  }

  const tokenHash = hashApiToken(token);
  const apiToken = await prisma.apiToken.findUnique({
    where: { tokenHash },
    include: {
      application: true
    }
  });

  if (
    !apiToken ||
    apiToken.revokedAt ||
    !apiToken.application.isActive ||
    !safeTokenEquals(apiToken.tokenHash, tokenHash)
  ) {
    return { application: null, response: unauthorized() };
  }

  await prisma.apiToken.update({
    where: { id: apiToken.id },
    data: { lastUsedAt: new Date() }
  });

  return { application: apiToken.application, response: null };
}
