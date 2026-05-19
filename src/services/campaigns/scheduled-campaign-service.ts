import { prisma } from "@/lib/prisma/client";
import { prepareCampaignQueue } from "@/services/campaigns/campaign-send-service";

export async function processDueScheduledCampaigns() {
  const campaigns = await prisma.campaign.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: {
        lte: new Date()
      }
    },
    include: {
      owner: true
    },
    take: 20,
    orderBy: {
      scheduledAt: "asc"
    }
  });
  const results = [];

  for (const campaign of campaigns) {
    try {
      const result = await prepareCampaignQueue({
        campaignId: campaign.id,
        user: campaign.owner,
        payload: {}
      });
      results.push({ campaignId: campaign.id, ok: true, ...result });
    } catch (error) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: {
          status: "FAILED"
        }
      });
      results.push({
        campaignId: campaign.id,
        ok: false,
        message: error instanceof Error ? error.message : "Erro ao processar campanha agendada."
      });
    }
  }

  return results;
}
