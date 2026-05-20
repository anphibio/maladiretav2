import { NextResponse } from "next/server";
import { requireApiApplication } from "@/lib/auth/api-application";
import { apiEmailQueueQuerySchema } from "@/features/api-email/schemas";
import { listApiEmailQueue } from "@/services/api-email/api-email-service";

export async function GET(request: Request) {
  const { application, response } = await requireApiApplication(request);

  if (!application) {
    return response;
  }

  const url = new URL(request.url);
  const parsed = apiEmailQueueQuerySchema.parse({
    page: url.searchParams.get("page") ?? undefined,
    pageSize: url.searchParams.get("pageSize") ?? undefined
  });
  const result = await listApiEmailQueue({
    applicationId: application.id,
    page: parsed.page,
    pageSize: parsed.pageSize
  });

  return NextResponse.json(result);
}
