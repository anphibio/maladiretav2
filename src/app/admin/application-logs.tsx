"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ApplicationOption = {
  id: string;
  name: string;
};

type ApiEmailLogRow = {
  id: string;
  applicationId: string;
  applicationName: string;
  recipientEmail: string;
  senderEmail: string;
  status: "QUEUED" | "SENDING" | "SENT" | "FAILED" | "BOUNCED";
  externalReferenceId: string | null;
  message: string | null;
  smtpResponse: string | null;
  attempts: number;
  updatedAt: string;
  createdAt: string;
};

type ApiEmailLogResult = {
  page: number;
  pageSize: number;
  total: number;
  retentionDays: number;
  items: ApiEmailLogRow[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(value));
}

function statusLabel(status: ApiEmailLogRow["status"]) {
  const labels = {
    QUEUED: "Aguardando",
    SENDING: "Enviando",
    SENT: "Enviado",
    FAILED: "Falha",
    BOUNCED: "Bounce"
  };

  return labels[status];
}

function toRows(result: ApiEmailLogResult): ApiEmailLogRow[] {
  return result.items.map((item) => ({
    ...item,
    updatedAt: String(item.updatedAt),
    createdAt: String(item.createdAt)
  }));
}

function isLogResult(payload: ApiEmailLogResult | { message?: string } | null): payload is ApiEmailLogResult {
  return Boolean(payload && "items" in payload && Array.isArray(payload.items));
}

export function ApplicationLogs({
  applications,
  initialResult
}: {
  applications: ApplicationOption[];
  initialResult: ApiEmailLogResult;
}) {
  const [result, setResult] = useState<ApiEmailLogResult>({
    ...initialResult,
    items: toRows(initialResult)
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(result.total / result.pageSize)),
    [result.pageSize, result.total]
  );

  async function loadLogs(event?: FormEvent<HTMLFormElement>, page = 1) {
    event?.preventDefault();
    const form = event?.currentTarget ?? document.querySelector<HTMLFormElement>("[data-api-log-filters]");

    if (!form) {
      return;
    }

    setLoading(true);
    setMessage(null);

    const formData = new FormData(form);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(result.pageSize)
    });
    const applicationId = String(formData.get("applicationId") ?? "");
    const status = String(formData.get("status") ?? "");
    const search = String(formData.get("search") ?? "");

    if (applicationId) {
      params.set("applicationId", applicationId);
    }

    if (status) {
      params.set("status", status);
    }

    if (search) {
      params.set("search", search);
    }

    const response = await fetch(`/api/admin/applications/logs?${params.toString()}`);
    const payload = (await response.json().catch(() => null)) as ApiEmailLogResult | { message?: string } | null;

    setLoading(false);

    if (!response.ok || !isLogResult(payload)) {
      setMessage(payload && "message" in payload ? payload.message ?? "Não foi possível carregar os logs." : "Não foi possível carregar os logs.");
      return;
    }

    setResult({
      ...payload,
      items: toRows(payload)
    });
  }

  return (
    <div className="space-y-4">
      <form
        className="grid gap-3 border-b border-border p-5 md:grid-cols-[1fr_180px_1.5fr_120px]"
        data-api-log-filters
        onSubmit={loadLogs}
      >
        <label className="text-sm font-medium text-slate-800">
          Aplicação
          <select
            className="mt-2 h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-slate-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            name="applicationId"
          >
            <option value="">Todas</option>
            {applications.map((application) => (
              <option key={application.id} value={application.id}>
                {application.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-800">
          Status
          <select
            className="mt-2 h-10 w-full rounded-md border border-input bg-white px-3 text-sm text-slate-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            name="status"
          >
            <option value="">Todos</option>
            <option value="QUEUED">Aguardando</option>
            <option value="SENDING">Enviando</option>
            <option value="SENT">Enviado</option>
            <option value="FAILED">Falha</option>
            <option value="BOUNCED">Bounce</option>
          </select>
        </label>
        <label className="text-sm font-medium text-slate-800">
          Buscar
          <Input className="mt-2" name="search" placeholder="Destinatário, remetente, referência ou erro" />
        </label>
        <div className="flex items-end">
          <Button className="h-10 w-full" disabled={loading}>
            <Search className="mr-2 h-4 w-4" />
            Buscar
          </Button>
        </div>
      </form>

      <div className="flex items-center justify-between px-5 text-sm text-muted-foreground">
        <span>Retenção automática: {result.retentionDays} dias.</span>
        <span>
              Página {result.page} de {totalPages} · {result.total} envios
        </span>
      </div>
      {message ? <p className="px-5 text-sm text-red-700">{message}</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1180px] text-left text-sm">
          <thead className="border-y border-border bg-slate-50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Última atualização</th>
              <th className="px-5 py-3">Aplicação</th>
              <th className="px-5 py-3">Remetente</th>
              <th className="px-5 py-3">Destinatário</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Referência</th>
              <th className="px-5 py-3">Mensagem</th>
            </tr>
          </thead>
          <tbody>
            {result.items.length === 0 ? (
              <tr>
                <td className="px-5 py-8 text-center text-muted-foreground" colSpan={7}>
                  Nenhum evento de aplicação externa encontrado.
                </td>
              </tr>
            ) : null}
            {result.items.map((item) => (
              <tr key={item.id} className="border-b border-border align-top last:border-0">
                <td className="px-5 py-4 text-muted-foreground">{formatDate(item.updatedAt)}</td>
                <td className="px-5 py-4 font-medium text-slate-900">{item.applicationName}</td>
                <td className="px-5 py-4 text-muted-foreground">{item.senderEmail}</td>
                <td className="px-5 py-4 text-muted-foreground">{item.recipientEmail}</td>
                <td className="px-5 py-4 text-muted-foreground">{statusLabel(item.status)}</td>
                <td className="px-5 py-4 text-muted-foreground">{item.externalReferenceId ?? "-"}</td>
                <td className="max-w-md px-5 py-4 text-muted-foreground">
                  <span className="line-clamp-2" title={item.message ?? item.smtpResponse ?? undefined}>
                    {item.message ?? item.smtpResponse ?? "-"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-end gap-2 px-5 pb-5">
        <Button
          disabled={loading || result.page <= 1}
          type="button"
          variant="secondary"
          onClick={() => loadLogs(undefined, result.page - 1)}
        >
          Anterior
        </Button>
        <Button
          disabled={loading || result.page >= totalPages}
          type="button"
          variant="secondary"
          onClick={() => loadLogs(undefined, result.page + 1)}
        >
          Próxima
        </Button>
      </div>
    </div>
  );
}
