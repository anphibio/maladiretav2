"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type EditableCampaign = {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  status: string;
};

export function CampaignEditForm({ campaign }: { campaign: EditableCampaign }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const canEdit = campaign.status === "DRAFT";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit) {
      return;
    }

    setMessage(null);
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch(`/api/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: String(formData.get("name") ?? ""),
        subject: String(formData.get("subject") ?? ""),
        htmlBody: String(formData.get("htmlBody") ?? ""),
        textBody: String(formData.get("textBody") ?? "")
      })
    });
    const result = (await response.json().catch(() => null)) as { message?: string } | null;

    setIsLoading(false);

    if (!response.ok) {
      setMessage(result?.message ?? "Não foi possível salvar a campanha.");
      return;
    }

    setMessage("Campanha atualizada com sucesso.");
    router.refresh();
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-800">
          Nome
          <Input className="mt-2" defaultValue={campaign.name} disabled={!canEdit} name="name" required />
        </label>
        <label className="text-sm font-medium text-slate-800">
          Assunto
          <Input className="mt-2" defaultValue={campaign.subject} disabled={!canEdit} name="subject" required />
        </label>
      </div>
      <label className="block text-sm font-medium text-slate-800">
        Corpo HTML
        <textarea
          className="mt-2 min-h-32 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-slate-50"
          defaultValue={campaign.htmlBody}
          disabled={!canEdit}
          name="htmlBody"
          required
        />
      </label>
      <label className="block text-sm font-medium text-slate-800">
        Corpo em texto puro
        <textarea
          className="mt-2 min-h-28 w-full rounded-md border border-border bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:bg-slate-50"
          defaultValue={campaign.textBody}
          disabled={!canEdit}
          name="textBody"
          required
        />
      </label>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {canEdit ? (
        <Button disabled={isLoading}>
          <Save className="mr-2 h-4 w-4" />
          {isLoading ? "Salvando..." : "Salvar rascunho"}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">A edição fica bloqueada após sair do rascunho.</p>
      )}
    </form>
  );
}
