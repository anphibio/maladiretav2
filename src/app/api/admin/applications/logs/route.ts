import { NextResponse } from "next/server";
import { apiEmailLogQuerySchema } from "@/features/api-email/admin-schemas";
import { requireAdminForApi } from "@/lib/auth/current-user";
import { listApiEmailLogs } from "@/services/api-email/api-email-service";

export async function GET(request: Request) {
  const { user, response } = await requireAdminForApi();

  if (!user) {
    return response;
  }

  const url = new URL(request.url);
  const parsed = apiEmailLogQuerySchema.safeParse({
    applicationId: url.searchParams.get("applicationId") || undefined,
    status: url.searchParams.get("status") || undefined,
    search: url.searchParams.get("search") || undefined,
    page: url.searchParams.get("page") || undefined,
    pageSize: url.searchParams.get("pageSize") || undefined
  });

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Filtro inválido." },
      { status: 400 }
    );
  }

  const result = await listApiEmailLogs(parsed.data);

  return NextResponse.json({
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    retentionDays: result.retentionDays,
    items: result.items.map((item) => ({
      id: item.id,
      applicationId: item.applicationId,
      applicationName: item.applicationName,
      recipientEmail: item.recipientEmail,
      senderEmail: item.senderEmail,
      status: item.status,
      externalReferenceId: item.externalReferenceId,
      message: item.message,
      smtpResponse: item.smtpResponse,
      attempts: item.attempts,
      updatedAt: item.updatedAt.toISOString(),
      createdAt: item.createdAt.toISOString()
    }))
  });
}
