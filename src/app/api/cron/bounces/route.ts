import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-secret");

  if (!secret || provided !== secret) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  return NextResponse.json(
    { message: "A checagem de bounces exige a senha do usuário logado. Use POST /api/bounces pela aplicação." },
    { status: 400 }
  );
}
