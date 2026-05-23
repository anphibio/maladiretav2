import { NextRequest, NextResponse } from "next/server";
import { cleanupOldApiEmailLogs } from "@/services/api-email/api-email-service";

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-secret");

  if (!secret || provided !== secret) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  const result = await cleanupOldApiEmailLogs();
  return NextResponse.json(result);
}
