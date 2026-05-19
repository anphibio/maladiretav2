"use client";

import { useEffect, useState } from "react";
import { Eye, PauseCircle, PlayCircle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

type CampaignStatus = "DRAFT" | "SCHEDULED" | "QUEUED" | "SENDING" | "SENT" | "FAILED" | "PAUSED" | "CANCELED" | "COMPLETED";

type CampaignRow = {
  id: string;
  name: string;
  status: CampaignStatus;
  scheduledAt: string | Date | null;
  recipients: number;
};

type CampaignsResponse = {
  campaigns?: CampaignRow[];
};

const statusLabels: Record<CampaignStatus, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendado",
  QUEUED: "Em fila",
  SENDING: "Enviando",
  SENT: "Enviado",
  FAILED: "Falhou",
  PAUSED: "Pausado",
  CANCELED: "Cancelado",
  COMPLETED: "Concluído"
};

function formatDateTime(date: string | Date | null): string {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(date));
}

export function CampaignsTable({ initialCampaigns }: { initialCampaigns: CampaignRow[] }) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);

  useEffect(() => {
    let active = true;

    async function refreshCampaigns() {
      const response = await fetch("/api/campaigns", {
        cache: "no-store"
      });

      if (!response.ok) {
        return;
      }

      const data = (await response.json().catch(() => null)) as CampaignsResponse | null;

      if (active && data?.campaigns) {
        setCampaigns(data.campaigns);
      }
    }

    const interval = window.setInterval(refreshCampaigns, 5000);
    void refreshCampaigns();

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[680px] text-left text-sm">
        <thead className="border-b border-border bg-slate-50 text-xs uppercase text-muted-foreground">
          <tr>
            <th className="px-5 py-3">Nome</th>
            <th className="px-5 py-3">Status</th>
            <th className="px-5 py-3">Agendamento</th>
            <th className="px-5 py-3">Destinatários</th>
            <th className="px-5 py-3">Ações</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.length === 0 ? (
            <tr>
              <td className="px-5 py-8 text-center text-muted-foreground" colSpan={5}>
                Nenhuma campanha criada ainda.
              </td>
            </tr>
          ) : null}
          {campaigns.map((campaign) => (
            <tr key={campaign.id} className="border-b border-border last:border-0">
              <td className="px-5 py-4 font-medium text-slate-900">{campaign.name}</td>
              <td className="px-5 py-4 text-muted-foreground">{statusLabels[campaign.status]}</td>
              <td className="px-5 py-4 text-muted-foreground">{formatDateTime(campaign.scheduledAt)}</td>
              <td className="px-5 py-4 text-muted-foreground">{campaign.recipients}</td>
              <td className="px-5 py-4">
                <div className="flex gap-2">
                  <Link
                    className="inline-flex h-8 items-center justify-center rounded-md bg-slate-100 px-3 text-sm font-medium text-slate-900 hover:bg-slate-200"
                    href={`/campaigns/${campaign.id}`}
                  >
                    <Eye className="h-4 w-4" />
                  </Link>
                  <Button variant="secondary" className="h-8 px-3" disabled={campaign.status !== "DRAFT"}>
                    <PlayCircle className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" className="h-8 px-3" disabled={campaign.status !== "SENDING"}>
                    <PauseCircle className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
