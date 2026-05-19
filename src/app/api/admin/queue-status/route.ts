import { NextResponse } from "next/server";
import { requireAdminForApi } from "@/lib/auth/current-user";
import { getQueueStatusSummary } from "@/services/admin/queue-status-service";

export async function GET() {
  const { user, response } = await requireAdminForApi();

  if (!user) {
    return response;
  }

  const status = await getQueueStatusSummary();

  return NextResponse.json({ status });
}
