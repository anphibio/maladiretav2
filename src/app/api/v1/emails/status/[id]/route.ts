import { NextResponse } from "next/server";
import { requireApiApplication } from "@/lib/auth/api-application";
import { getApiEmailStatus } from "@/services/api-email/api-email-service";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const { application, response } = await requireApiApplication(request);

  if (!application) {
    return response;
  }

  const { id } = await context.params;
  const task = await getApiEmailStatus({
    applicationId: application.id,
    id
  });

  if (!task) {
    return NextResponse.json({ message: "E-mail não encontrado para esta aplicação." }, { status: 404 });
  }

  return NextResponse.json({ task });
}
