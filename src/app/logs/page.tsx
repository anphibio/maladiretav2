import Link from "next/link";
import { Download, FileClock, KeyRound, MailWarning, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { logQuerySchema, type LogQuery } from "@/features/logs/schemas";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { getLogSummary, listLogs } from "@/services/logs/log-service";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  type?: string;
  q?: string;
  limit?: string;
}>;

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "medium"
  }).format(date);
}

function buildQuery(type: LogQuery["type"], q?: string) {
  const params = new URLSearchParams({ type });

  if (q) {
    params.set("q", q);
  }

  return `/logs?${params.toString()}`;
}

function buildReportQuery(type: "audit" | "access" | "failures", q?: string) {
  const params = new URLSearchParams({ type, limit: "1000" });

  if (q) {
    params.set("q", q);
  }

  return `/api/reports?${params.toString()}`;
}

export default async function LogsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireCurrentUser();
  const params = await searchParams;
  const parsed = logQuerySchema.parse({
    type: params.type,
    q: params.q,
    limit: params.limit
  });
  const [summary, result] = await Promise.all([getLogSummary(user), listLogs(user, parsed)]);

  const metrics = [
    { label: "Auditoria", value: summary.auditCount, type: "audit" as const, icon: ShieldCheck },
    { label: "Acessos", value: summary.accessCount, type: "access" as const, icon: KeyRound },
    { label: "Envios", value: summary.emailCount, type: "email" as const, icon: MailWarning }
  ];

  return (
    <AppShell>
      <div className="mb-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-950">Logs</h1>
            <p className="mt-1 text-sm text-muted-foreground">Registros imutáveis de acesso, envio e auditoria.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <a
              className="inline-flex h-10 items-center rounded-md bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-200"
              href={buildReportQuery("audit", parsed.q)}
            >
              <Download className="mr-2 h-4 w-4" />
              Auditoria CSV
            </a>
            <a
              className="inline-flex h-10 items-center rounded-md bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-200"
              href={buildReportQuery("access", parsed.q)}
            >
              <Download className="mr-2 h-4 w-4" />
              Acessos CSV
            </a>
            <a
              className="inline-flex h-10 items-center rounded-md bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-200"
              href={buildReportQuery("failures", parsed.q)}
            >
              <Download className="mr-2 h-4 w-4" />
              Falhas CSV
            </a>
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          const active = parsed.type === metric.type;

          return (
            <Link key={metric.type} href={buildQuery(metric.type, parsed.q)}>
              <Card className={active ? "border-teal-600" : undefined}>
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-sm text-muted-foreground">{metric.label}</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{metric.value}</p>
                  </div>
                  <Icon className="h-5 w-5 text-teal-700" />
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <FileClock className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-base font-semibold text-slate-950">Eventos recentes</h2>
          </div>
          <form className="flex w-full gap-2 md:max-w-md">
            <input name="type" type="hidden" value={parsed.type} />
            <Input defaultValue={parsed.q ?? ""} name="q" placeholder="Buscar por usuário, ação, e-mail ou erro" />
            <button className="rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground" type="submit">
              Buscar
            </button>
          </form>
        </CardHeader>
        <CardContent className="p-0">
          {result.type === "audit" ? (
            <AuditLogTable items={result.items as Awaited<ReturnType<typeof import("@/services/logs/log-service").listAuditLogs>>} />
          ) : null}
          {result.type === "access" ? (
            <AccessLogTable items={result.items as Awaited<ReturnType<typeof import("@/services/logs/log-service").listAccessLogs>>} />
          ) : null}
          {result.type === "email" ? (
            <EmailLogTable items={result.items as Awaited<ReturnType<typeof import("@/services/logs/log-service").listEmailLogs>>} />
          ) : null}
        </CardContent>
      </Card>
    </AppShell>
  );
}

function AuditLogTable({
  items
}: {
  items: Awaited<ReturnType<typeof import("@/services/logs/log-service").listAuditLogs>>;
}) {
  return (
    <div className="max-h-[560px] overflow-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="sticky top-0 z-10 border-b border-border bg-slate-50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-5 py-3">Data</th>
            <th className="px-5 py-3">Ação</th>
            <th className="px-5 py-3">Usuário</th>
            <th className="px-5 py-3">Entidade</th>
            <th className="px-5 py-3">IP</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? <EmptyRow colSpan={5} /> : null}
          {items.map((item) => (
            <tr key={item.id} className="border-b border-border last:border-0">
              <td className="px-5 py-4 text-muted-foreground">{formatDate(item.createdAt)}</td>
              <td className="px-5 py-4 font-medium text-slate-900">{item.action}</td>
              <td className="px-5 py-4 text-muted-foreground">{item.userEmail ?? "-"}</td>
              <td className="px-5 py-4 text-muted-foreground">{item.entityType ?? "-"}</td>
              <td className="px-5 py-4 text-muted-foreground">{item.ip ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AccessLogTable({
  items
}: {
  items: Awaited<ReturnType<typeof import("@/services/logs/log-service").listAccessLogs>>;
}) {
  return (
    <div className="max-h-[560px] overflow-auto">
      <table className="w-full min-w-[820px] text-left text-sm">
        <thead className="sticky top-0 z-10 border-b border-border bg-slate-50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-5 py-3">Data</th>
            <th className="px-5 py-3">Ação</th>
            <th className="px-5 py-3">E-mail</th>
            <th className="px-5 py-3">Sucesso</th>
            <th className="px-5 py-3">IP</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? <EmptyRow colSpan={5} /> : null}
          {items.map((item) => (
            <tr key={item.id} className="border-b border-border last:border-0">
              <td className="px-5 py-4 text-muted-foreground">{formatDate(item.createdAt)}</td>
              <td className="px-5 py-4 font-medium text-slate-900">{item.action}</td>
              <td className="px-5 py-4 text-muted-foreground">{item.email}</td>
              <td className="px-5 py-4 text-muted-foreground">{item.success ? "Sim" : "Não"}</td>
              <td className="px-5 py-4 text-muted-foreground">{item.ip ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmailLogTable({
  items
}: {
  items: Awaited<ReturnType<typeof import("@/services/logs/log-service").listEmailLogs>>;
}) {
  return (
    <div className="max-h-[560px] overflow-auto">
      <table className="w-full min-w-[920px] text-left text-sm">
        <thead className="sticky top-0 z-10 border-b border-border bg-slate-50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-5 py-3">Data</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Remetente</th>
            <th className="px-5 py-3">Destinatário</th>
            <th className="px-5 py-3">Tentativas</th>
            <th className="px-5 py-3">Erro</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? <EmptyRow colSpan={6} /> : null}
          {items.map((item) => (
            <tr key={item.id} className="border-b border-border last:border-0">
              <td className="px-5 py-4 text-muted-foreground">{formatDate(item.createdAt)}</td>
              <td className="px-5 py-4 font-medium text-slate-900">{item.status}</td>
              <td className="px-5 py-4 text-muted-foreground">{item.senderEmail}</td>
              <td className="px-5 py-4 text-muted-foreground">{item.recipientEmail}</td>
              <td className="px-5 py-4 text-muted-foreground">{item.attempts}</td>
              <td className="px-5 py-4 text-muted-foreground">{item.errorMessage ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyRow({ colSpan }: { colSpan: number }) {
  return (
    <tr>
      <td className="px-5 py-8 text-center text-muted-foreground" colSpan={colSpan}>
        Nenhum registro encontrado.
      </td>
    </tr>
  );
}
