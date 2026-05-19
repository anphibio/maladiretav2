import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarClock, FileSpreadsheet, Mail, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CampaignActions } from "@/app/campaigns/[id]/campaign-actions";
import { CampaignEditForm } from "@/app/campaigns/[id]/campaign-edit-form";
import { ImportRecipientsForm } from "@/app/campaigns/[id]/import-recipients-form";
import { RecipientsStatusTable } from "@/app/campaigns/[id]/recipients-status-table";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { getCampaignForUser, getCampaignStatusLabel } from "@/services/campaigns/campaign-service";

export const dynamic = "force-dynamic";

function formatDateTime(date: Date | null): string {
  if (!date) {
    return "Sem agendamento";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(date);
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireCurrentUser();
  const { id } = await params;
  const campaign = await getCampaignForUser(id, user);

  if (!campaign) {
    notFound();
  }

  return (
    <AppShell>
      <div className="mb-6">
        <Link className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-slate-700 hover:text-slate-950" href="/campaigns">
          <ArrowLeft className="h-4 w-4" />
          Voltar para campanhas
        </Link>
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">{campaign.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{campaign.subject}</p>
          </div>
          <div className="rounded-md bg-slate-100 px-3 py-2 text-sm font-medium text-slate-800">
            {getCampaignStatusLabel(campaign.status)}
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Remetente</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{campaign.senderEmail}</p>
            </div>
            <Mail className="h-5 w-5 text-teal-700" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Destinatários</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{campaign._count.recipients}</p>
            </div>
            <Users className="h-5 w-5 text-teal-700" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Lotes importados</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{campaign.importBatches.length}</p>
            </div>
            <FileSpreadsheet className="h-5 w-5 text-teal-700" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-5">
            <div>
              <p className="text-sm text-muted-foreground">Agendamento</p>
              <p className="mt-2 text-sm font-semibold text-slate-950">{formatDateTime(campaign.scheduledAt)}</p>
            </div>
            <CalendarClock className="h-5 w-5 text-teal-700" />
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-base font-semibold text-slate-950">Anexos</h2>
        </CardHeader>
        <CardContent className="space-y-2">
          {campaign.attachments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum arquivo anexado.</p>
          ) : null}
          {campaign.attachments.map((attachment) => (
            <div key={attachment.id} className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2 text-sm">
              <span className="font-medium text-slate-800">{attachment.filename}</span>
              <span className="text-muted-foreground">{Math.ceil(attachment.sizeBytes / 1024)} KB</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mb-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Teste e fila</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Envie um teste antes de preparar os jobs de envio. A senha do Zimbra não é armazenada.
            </p>
          </CardHeader>
          <CardContent>
            <CampaignActions
              campaignId={campaign.id}
              canQueue={campaign._count.recipients > 0 && (campaign.status === "DRAFT" || campaign.status === "PAUSED" || campaign.status === "QUEUED")}
              canPause={campaign.status === "QUEUED" || campaign.status === "SENDING"}
              canCancel={!["COMPLETED", "CANCELED"].includes(campaign.status)}
              canRetryFailures={!["CANCELED"].includes(campaign.status)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Importar destinatários</h2>
            <p className="mt-1 text-sm text-muted-foreground">Campos mínimos: email,nome. Campos opcionais: cpf,setor,cargo,orgao,cidade,estado,tags.</p>
          </CardHeader>
          <CardContent>
            <ImportRecipientsForm campaignId={campaign.id} disabled={campaign.status !== "DRAFT" && campaign.status !== "SCHEDULED"} />
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <h2 className="text-base font-semibold text-slate-950">Últimos destinatários</h2>
          </CardHeader>
          <CardContent className="p-0">
            <RecipientsStatusTable
              campaignId={campaign.id}
              initialRecipients={campaign.recipients.map((recipient) => ({
                id: recipient.id,
                email: recipient.email,
                name: recipient.name,
                domain: recipient.domain,
                status: recipient.status,
                errorMessage: recipient.errorMessage
              }))}
            />
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-base font-semibold text-slate-950">Conteúdo da campanha</h2>
          <p className="mt-1 text-sm text-muted-foreground">Edite nome, assunto e mensagem enquanto a campanha estiver em rascunho.</p>
        </CardHeader>
        <CardContent>
          <CampaignEditForm
            campaign={{
              id: campaign.id,
              name: campaign.name,
              subject: campaign.subject,
              htmlBody: campaign.htmlBody,
              textBody: campaign.textBody,
              status: campaign.status
            }}
          />
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <h2 className="text-base font-semibold text-slate-950">Histórico de importações</h2>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-slate-50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Arquivo</th>
                  <th className="px-5 py-3">Total</th>
                  <th className="px-5 py-3">Válidos</th>
                  <th className="px-5 py-3">Inválidos</th>
                  <th className="px-5 py-3">Duplicados</th>
                  <th className="px-5 py-3">Erros</th>
                </tr>
              </thead>
              <tbody>
                {campaign.importBatches.length === 0 ? (
                  <tr>
                    <td className="px-5 py-8 text-center text-muted-foreground" colSpan={6}>
                      Nenhum lote importado.
                    </td>
                  </tr>
                ) : null}
                {campaign.importBatches.map((batch) => (
                  <tr key={batch.id} className="border-b border-border last:border-0">
                    <td className="px-5 py-4 font-medium text-slate-900">{batch.filename}</td>
                    <td className="px-5 py-4 text-muted-foreground">{batch.totalRows}</td>
                    <td className="px-5 py-4 text-muted-foreground">{batch.validRows}</td>
                    <td className="px-5 py-4 text-muted-foreground">{batch.invalidRows}</td>
                    <td className="px-5 py-4 text-muted-foreground">{batch.duplicatesRemoved}</td>
                    <td className="px-5 py-4 text-muted-foreground">{batch._count.errors}</td>
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
