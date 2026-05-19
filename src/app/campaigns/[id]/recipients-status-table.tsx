"use client";

import { useEffect, useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type RecipientStatus = "PENDING" | "SENT" | "FAILED" | "RESENT" | "CANCELED";

type RecipientRow = {
  id: string;
  email: string;
  name: string | null;
  domain: string;
  status: RecipientStatus;
  errorMessage?: string | null;
};

type CampaignResponse = {
  campaign?: {
    recipients: RecipientRow[];
  };
};

const statusLabels: Record<RecipientStatus, string> = {
  PENDING: "Aguardando envio",
  SENT: "Enviado",
  FAILED: "Falhou",
  RESENT: "Reenviado",
  CANCELED: "Cancelado"
};

const statusStyles: Record<RecipientStatus, string> = {
  PENDING: "bg-amber-50 text-amber-700 ring-amber-200",
  SENT: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  FAILED: "bg-red-50 text-red-700 ring-red-200",
  RESENT: "bg-blue-50 text-blue-700 ring-blue-200",
  CANCELED: "bg-slate-100 text-slate-700 ring-slate-200"
};

export function RecipientsStatusTable({
  campaignId,
  initialRecipients
}: {
  campaignId: string;
  initialRecipients: RecipientRow[];
}) {
  const [recipients, setRecipients] = useState(initialRecipients);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftEmail, setDraftEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function refreshRecipients() {
      const response = await fetch(`/api/campaigns/${campaignId}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        return;
      }

      const data = (await response.json().catch(() => null)) as CampaignResponse | null;

      if (active && data?.campaign?.recipients) {
        setRecipients(data.campaign.recipients);
        setLastUpdatedAt(new Date());
      }
    }

    const interval = window.setInterval(refreshRecipients, 5000);
    void refreshRecipients();

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, [campaignId]);

  function startEditing(recipient: RecipientRow) {
    setEditingId(recipient.id);
    setDraftEmail(recipient.email);
    setMessage(null);
  }

  function cancelEditing() {
    setEditingId(null);
    setDraftEmail("");
    setMessage(null);
  }

  async function saveRecipientEmail(recipientId: string) {
    setIsSaving(true);
    setMessage(null);

    const response = await fetch(`/api/campaigns/${campaignId}/recipients/${recipientId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ email: draftEmail })
    });
    const result = (await response.json().catch(() => null)) as {
      message?: string;
      recipient?: RecipientRow;
    } | null;

    setIsSaving(false);

    if (!response.ok || !result?.recipient) {
      setMessage(result?.message ?? "Não foi possível atualizar o destinatário.");
      return;
    }

    setRecipients((current) =>
      current.map((recipient) =>
        recipient.id === recipientId
          ? {
              ...recipient,
              email: result.recipient!.email,
              domain: result.recipient!.domain,
              errorMessage: result.recipient!.errorMessage
            }
          : recipient
      )
    );
    setEditingId(null);
    setDraftEmail("");
    setMessage("Destinatário atualizado.");
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center justify-between border-b border-border px-5 py-2 text-xs text-muted-foreground">
        <span>Status atualizado automaticamente.</span>
        <span>{lastUpdatedAt ? `Última atualização: ${lastUpdatedAt.toLocaleTimeString("pt-BR")}` : "Atualizando..."}</span>
      </div>
      {message ? <div className="border-b border-border px-5 py-2 text-xs text-muted-foreground">{message}</div> : null}
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead className="border-b border-border bg-slate-50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-5 py-3">E-mail</th>
            <th className="px-5 py-3">Nome</th>
            <th className="px-5 py-3">Domínio</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Erro</th>
            <th className="px-5 py-3">Ações</th>
          </tr>
        </thead>
        <tbody>
          {recipients.length === 0 ? (
            <tr>
              <td className="px-5 py-8 text-center text-muted-foreground" colSpan={6}>
                Nenhum destinatário importado.
              </td>
            </tr>
          ) : null}
          {recipients.map((recipient) => (
            <tr key={recipient.id} className="border-b border-border last:border-0">
              <td className="px-5 py-4 font-medium text-slate-900">
                {editingId === recipient.id ? (
                  <Input
                    className="h-9 min-w-72"
                    type="email"
                    value={draftEmail}
                    onChange={(event) => setDraftEmail(event.target.value)}
                  />
                ) : (
                  recipient.email
                )}
              </td>
              <td className="px-5 py-4 text-muted-foreground">{recipient.name ?? "-"}</td>
              <td className="px-5 py-4 text-muted-foreground">{recipient.domain}</td>
              <td className="px-5 py-4">
                <span
                  className={cn(
                    "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
                    statusStyles[recipient.status]
                  )}
                  title={recipient.errorMessage ?? undefined}
                >
                  {statusLabels[recipient.status]}
                </span>
              </td>
              <td className="max-w-xs px-5 py-4 text-muted-foreground">
                <span className="line-clamp-2" title={recipient.errorMessage ?? undefined}>
                  {recipient.errorMessage ?? "-"}
                </span>
              </td>
              <td className="px-5 py-4">
                {recipient.status === "FAILED" ? (
                  editingId === recipient.id ? (
                    <div className="flex gap-2">
                      <Button className="h-9 px-3" disabled={isSaving || !draftEmail} type="button" onClick={() => saveRecipientEmail(recipient.id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button className="h-9 px-3" disabled={isSaving} type="button" variant="secondary" onClick={cancelEditing}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Button className="h-9 px-3" type="button" variant="secondary" onClick={() => startEditing(recipient)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )
                ) : (
                  <span className="text-muted-foreground">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
