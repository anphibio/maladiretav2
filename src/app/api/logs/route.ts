import { NextRequest, NextResponse } from "next/server";
import { logQuerySchema } from "@/features/logs/schemas";
import { requireCurrentUserForApi } from "@/lib/auth/current-user";
import { getLogSummary, listLogs } from "@/services/logs/log-service";

export async function GET(request: NextRequest) {
  const { user, response } = await requireCurrentUserForApi();

  if (!user) {
    return response;
  }

  const parsed = logQuerySchema.safeParse({
    type: request.nextUrl.searchParams.get("type") ?? undefined,
    q: request.nextUrl.searchParams.get("q") ?? undefined,
    limit: request.nextUrl.searchParams.get("limit") ?? undefined
  });

  if (!parsed.success) {
    return NextResponse.json({ message: "Filtros inválidos." }, { status: 400 });
  }

  const [summary, logs] = await Promise.all([getLogSummary(user), listLogs(user, parsed.data)]);

  return NextResponse.json({ summary, ...logs });
}
