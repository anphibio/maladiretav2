import { NextRequest, NextResponse } from "next/server";
import { reportQuerySchema } from "@/features/reports/schemas";
import { requireCurrentUserForApi } from "@/lib/auth/current-user";
import { buildReport } from "@/services/reports/report-service";

export async function GET(request: NextRequest) {
  const { user, response } = await requireCurrentUserForApi();

  if (!user) {
    return response;
  }

  const parsed = reportQuerySchema.safeParse({
    type: request.nextUrl.searchParams.get("type") ?? undefined,
    q: request.nextUrl.searchParams.get("q") ?? undefined,
    limit: request.nextUrl.searchParams.get("limit") ?? undefined
  });

  if (!parsed.success) {
    return NextResponse.json({ message: "Parâmetros de relatório inválidos." }, { status: 400 });
  }

  const csv = await buildReport(user, parsed.data);
  const filename = `${parsed.data.type}-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`
    }
  });
}
