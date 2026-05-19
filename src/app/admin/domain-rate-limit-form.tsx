"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DomainRateLimitRow = {
  id: string;
  domain: string;
  messagesPerMinute: number;
  delayMs: number;
  active: boolean;
};

function msToSeconds(value: number): number {
  return Math.round(value / 1000);
}

export function DomainRateLimitForm({ limits }: { limits: DomainRateLimitRow[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(limits);
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [domain, setDomain] = useState("");
  const [messagesPerMinute, setMessagesPerMinute] = useState("");
  const [delaySeconds, setDelaySeconds] = useState("");
  const [active, setActive] = useState(true);

  function editLimit(limit: DomainRateLimitRow) {
    setDomain(limit.domain);
    setMessagesPerMinute(String(limit.messagesPerMinute));
    setDelaySeconds(String(msToSeconds(limit.delayMs)));
    setActive(limit.active);
    setMessage(`Editando ${limit.domain}.`);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/domain-rate-limits", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        domain: String(formData.get("domain") ?? ""),
        messagesPerMinute: Number(formData.get("messagesPerMinute") ?? 0),
        delayMs: Number(formData.get("delaySeconds") ?? 0) * 1000,
        active: formData.get("active") === "on"
      })
    });
    const result = (await response.json().catch(() => null)) as { message?: string; limit?: DomainRateLimitRow } | null;

    setIsLoading(false);

    if (!response.ok) {
      setMessage(result?.message ?? "Não foi possível salvar o limite.");
      return;
    }

    setMessage("Limite salvo com sucesso.");
    if (result?.limit) {
      const savedLimit = result.limit;

      setRows((current) => {
        const exists = current.some((item) => item.id === savedLimit.id || item.domain === savedLimit.domain);
        const next = exists
          ? current.map((item) => (item.id === savedLimit.id || item.domain === savedLimit.domain ? savedLimit : item))
          : [...current, savedLimit];

        return next.sort((a, b) => Number(b.active) - Number(a.active) || a.domain.localeCompare(b.domain));
      });
    }
    router.refresh();
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <form className="grid gap-4 md:grid-cols-[1fr_160px_160px_120px] md:items-end" onSubmit={handleSubmit}>
        <label className="text-sm font-medium text-slate-800">
          Domínio
          <Input className="mt-2" name="domain" placeholder="exemplo.com" required value={domain} onChange={(event) => setDomain(event.target.value)} />
        </label>
        <label className="text-sm font-medium text-slate-800">
          Mensagens/min
          <Input className="mt-2" min={1} name="messagesPerMinute" required type="number" value={messagesPerMinute} onChange={(event) => setMessagesPerMinute(event.target.value)} />
        </label>
        <label className="text-sm font-medium text-slate-800">
          Delay (s)
          <Input className="mt-2" min={0} name="delaySeconds" required type="number" value={delaySeconds} onChange={(event) => setDelaySeconds(event.target.value)} />
        </label>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <input className="h-4 w-4" checked={active} name="active" type="checkbox" onChange={(event) => setActive(event.target.checked)} />
            Ativo
          </label>
          <Button className="w-full" disabled={isLoading}>
            <Save className="mr-2 h-4 w-4" />
            Salvar
          </Button>
        </div>
        {message ? <p className="text-sm text-muted-foreground md:col-span-4">{message}</p> : null}
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-border bg-slate-50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Domínio</th>
              <th className="px-5 py-3">Mensagens/min</th>
              <th className="px-5 py-3">Delay</th>
              <th className="px-5 py-3">Status</th>
              <th className="px-5 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((limit) => (
              <tr key={limit.id} className="border-b border-border last:border-0">
                <td className="px-5 py-4 font-medium text-slate-900">{limit.domain}</td>
                <td className="px-5 py-4 text-muted-foreground">{limit.messagesPerMinute}</td>
                <td className="px-5 py-4 text-muted-foreground">{msToSeconds(limit.delayMs)} s</td>
                <td className="px-5 py-4 text-muted-foreground">{limit.active ? "Ativo" : "Inativo"}</td>
                <td className="px-5 py-4">
                  <Button className="h-8 px-3" type="button" variant="secondary" onClick={() => editLimit(limit)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
