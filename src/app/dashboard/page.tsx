import Link from "next/link";
import { Activity, AlertTriangle, CheckCircle2, Clock, ListChecks, TimerReset } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DashboardChart } from "@/components/charts/dashboard-chart";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { getDashboardData } from "@/services/dashboard/dashboard-service";
import { getCampaignStatusLabel } from "@/services/campaigns/campaign-service";

export const dynamic = "force-dynamic";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export default async function DashboardPage() {
  const user = await requireCurrentUser();
  const data = await getDashboardData(user);
  const metrics = [
    { label: "Campanhas", value: formatNumber(data.metrics.campaigns), icon: Activity },
    { label: "E-mails enviados", value: formatNumber(data.metrics.sentEmails), icon: CheckCircle2 },
    { label: "Falhas", value: formatNumber(data.metrics.failures), icon: AlertTriangle },
    { label: "Agendadas", value: formatNumber(data.metrics.scheduled), icon: Clock }
  ];

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-950">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">Visão operacional dos envios, falhas e fila.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.label}>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">{metric.label}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{metric.value}</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-md bg-teal-50 text-teal-700">
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Taxa de sucesso</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{data.metrics.successRate}%</p>
            </div>
            <ListChecks className="h-5 w-5 text-teal-700" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Jobs aguardando</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{formatNumber(data.metrics.queueWaiting)}</p>
            </div>
            <TimerReset className="h-5 w-5 text-teal-700" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Jobs com falha</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{formatNumber(data.metrics.queueFailed)}</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Envios por dia</h2>
          </CardHeader>
          <CardContent>
            <DashboardChart data={data.dailySeries} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Falhas por domínio</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.failureDomains.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma falha registrada.</p>
            ) : null}
            {data.failureDomains.map((item) => (
              <div key={item.domain} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2">
                <span className="text-sm font-medium text-slate-800">{item.domain}</span>
                <span className="text-xs text-muted-foreground">{item.failures} falhas</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="text-base font-semibold text-slate-950">Campanhas recentes</h2>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-slate-50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Nome</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Remetente</th>
                  <th className="px-5 py-3">Destinatários</th>
                  <th className="px-5 py-3">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {data.recentCampaigns.length === 0 ? (
                  <tr>
                    <td className="px-5 py-8 text-center text-muted-foreground" colSpan={5}>
                      Nenhuma campanha criada ainda.
                    </td>
                  </tr>
                ) : null}
                {data.recentCampaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-4 font-medium text-slate-900">{campaign.name}</td>
                    <td className="px-5 py-4 text-muted-foreground">{getCampaignStatusLabel(campaign.status)}</td>
                    <td className="px-5 py-4 text-muted-foreground">{campaign.senderEmail}</td>
                    <td className="px-5 py-4 text-muted-foreground">{campaign._count.recipients}</td>
                    <td className="px-5 py-4">
                      <Link className="text-sm font-medium text-teal-700 hover:text-teal-900" href={`/campaigns/${campaign.id}`}>
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </AppShell>
  );
}
