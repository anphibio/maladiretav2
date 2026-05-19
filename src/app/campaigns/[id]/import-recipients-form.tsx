"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type ImportSummary = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicatesRemoved: number;
};

export function ImportRecipientsForm({ campaignId, disabled }: { campaignId: string; disabled: boolean }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSummary(null);
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch(`/api/campaigns/${campaignId}/recipients/import`, {
      method: "POST",
      body: formData
    });
    const result = (await response.json().catch(() => null)) as {
      message?: string;
      summary?: ImportSummary;
    } | null;

    setIsLoading(false);

    if (!response.ok) {
      setError(result?.message ?? "Não foi possível importar o arquivo.");
      return;
    }

    setSummary(result?.summary ?? null);
    router.refresh();
    event.currentTarget.reset();
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-800">Arquivo de destinatários</label>
        <input
          accept=".csv,.xlsx"
          className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-800"
          disabled={disabled || isLoading}
          name="file"
          required
          type="file"
        />
      </div>
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}
      {summary ? (
        <div className="grid gap-2 rounded-md border border-teal-200 bg-teal-50 p-3 text-sm text-teal-900 md:grid-cols-4">
          <span>Total: {summary.totalRows}</span>
          <span>Válidos: {summary.validRows}</span>
          <span>Inválidos: {summary.invalidRows}</span>
          <span>Duplicados: {summary.duplicatesRemoved}</span>
        </div>
      ) : null}
      <Button disabled={disabled || isLoading}>
        <Upload className="mr-2 h-4 w-4" />
        {isLoading ? "Importando..." : "Importar destinatários"}
      </Button>
      {disabled ? <p className="text-xs text-muted-foreground">Importação permitida apenas em campanhas em rascunho.</p> : null}
    </form>
  );
}
