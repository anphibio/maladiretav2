import { NextRequest, NextResponse } from "next/server";
import { requireCurrentUserForApi } from "@/lib/auth/current-user";
import { processBounceMailbox } from "@/services/bounces/bounce-service";

export async function POST(request: NextRequest) {
  const { user, response } = await requireCurrentUserForApi();

  if (!user) {
    return response;
  }

  const body = (await request.json().catch(() => null)) as { password?: string } | null;

  try {
    const results = await processBounceMailbox({
      email: user.email,
      password: body?.password ?? ""
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
