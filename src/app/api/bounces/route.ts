import { NextResponse } from "next/server";
import { requireCurrentUserForApi } from "@/lib/auth/current-user";
import { processBounceMailbox } from "@/services/bounces/bounce-service";
import { getTemporaryLoginCredential } from "@/services/zimbra/credential-vault";

export async function POST() {
  const { user, response } = await requireCurrentUserForApi();

  if (!user) {
    return response;
  }

  try {
    const credential = await getTemporaryLoginCredential(user.email);

    if (!credential || credential.email !== user.email) {
      return NextResponse.json(
        { message: "Faça login novamente para atualizar a credencial temporária de bounces." },
        { status: 401 }
      );
    }

    const results = await processBounceMailbox({
      email: credential.email,
      password: credential.password
    });

    return NextResponse.json({
      processed: results.length,
      registered: results.filter((result) => result.ok).length,
      results
    });
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "Não foi possível checar bounces." },
      { status: 400 }
    );
  }
}
