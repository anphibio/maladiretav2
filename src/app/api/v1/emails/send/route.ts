import { NextResponse } from "next/server";
import { requireApiApplication } from "@/lib/auth/api-application";
import { sendApiEmailSchema } from "@/features/api-email/schemas";
import { createApiEmailTasks } from "@/services/api-email/api-email-service";

/**
 * POST /api/v1/emails/send
 * Header: Authorization: AppToken app_xxx
 *
 * Payload unico:
 * { "toEmail": "destino@exemplo.com", "subject": "Assunto", "body": "Mensagem", "externalReferenceId": "abc-123" }
 *
 * Payload em lote:
 * [{ "toEmail": "a@exemplo.com", "subject": "Assunto", "htmlBody": "<p>Mensagem</p>", "textBody": "Mensagem" }]
 */
export async function POST(request: Request) {
  const { application, response } = await requireApiApplication(request);

  if (!application) {
    return response;
  }

  const body = await request.json().catch(() => null);
  const parsed = sendApiEmailSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: parsed.error.errors[0]?.message ?? "Payload inválido." },
      { status: 400 }
    );
  }

  try {
    const items = Array.isArray(parsed.data) ? parsed.data : [parsed.data];
    const result = await createApiEmailTasks({ application, items });

    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Não foi possível enfileirar os e-mails." },
      { status: 400 }
    );
  }
}
