import { NextRequest, NextResponse } from "next/server";
import { processDueScheduledCampaigns } from "@/services/campaigns/scheduled-campaign-service";

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const provided = request.headers.get("x-cron-secret");

  if (!secret || provided !== secret) {
    return NextResponse.json({ message: "Não autorizado." }, { status: 401 });
  }

  const results = await processDueScheduledCampaigns();

  return NextResponse.json({ processed: results.length, results });
}
