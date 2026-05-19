import { CalendarClock, Download } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CampaignsTable } from "@/app/campaigns/campaigns-table";
import { NewCampaignForm } from "@/app/campaigns/new-campaign-form";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { listCampaignsForUser } from "@/services/campaigns/campaign-service";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const user = await requireCurrentUser();
  const campaigns = await listCampaignsForUser(user);

  return (
    <AppShell>
      <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-950">Campanhas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Criação, agendamento, fila e acompanhamento por destinatário.</p>
        </div>
        <div className="flex flex-col gap-2 md:items-end">
          <div className="text-sm text-muted-foreground">Remetente: {user.email}</div>
          <a
            className="inline-flex h-10 items-center rounded-md bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-200"
            href="/api/reports?type=campaigns&limit=1000"
          >
            <Download className="mr-2 h-4 w-4" />
            Campanhas CSV
          </a>
        </div>
      </div>
      <div className="mb-5">
        <NewCampaignForm senderEmail={user.email} />
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <h2 className="text-base font-semibold text-slate-950">Campanhas recentes</h2>
          <CalendarClock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="p-0">
          <CampaignsTable
            initialCampaigns={campaigns.map((campaign) => ({
              id: campaign.id,
              name: campaign.name,
              status: campaign.status,
              scheduledAt: campaign.scheduledAt,
              recipients: campaign._count.recipients
            }))}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
