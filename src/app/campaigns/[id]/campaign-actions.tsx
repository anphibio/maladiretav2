"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pause, PlayCircle, RotateCcw, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function CampaignActions({
  campaignId,
  canQueue,
  canPause,
  canCancel,
  canRetryFailures
}: {
  campaignId: string;
  canQueue: boolean;
  canPause: boolean;
  canCancel: boolean;
  canRetryFailures: boolean;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function post(path: string, body?: unknown) {
    setIsLoading(true);
    setMessage(null);

    const response = await fetch(path, {
      method: "POST",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const result = (await response.json().catch(() => null)) as { message?: string } | null;

    setIsLoading(false);

    if (!response.ok) {
      setMessage(result?.message ?? "Não foi possível concluir a ação.");
      return;
    }

    setMessage("Ação executada com sucesso.");
    router.refresh();
  }

  async function handleSendTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await post(`/api/campaigns/${campaignId}/send-test`, { recipientEmail: testEmail, password });
  }

  return (
    <div className="space-y-5">
      <form className="space-y-3" onSubmit={handleSendTest}>
        <label className="block text-sm font-medium text-slate-800">
          E-mail de teste
          <Input
            className="mt-2"
            placeholder="destinatario@exemplo.com"
            type="email"
            value={testEmail}
            onChange={(event) => setTestEmail(event.target.value)}
          />
        </label>
        <label className="block text-sm font-medium text-slate-800">
          Senha
          <Input
            className="mt-2"
            placeholder="Digite sua senha"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <Button disabled={isLoading || !testEmail || !password} type="submit" variant="secondary">
            <Send className="mr-2 h-4 w-4" />
            Enviar teste
          </Button>
          <Button
            disabled={isLoading || !canQueue}
            type="button"
            onClick={() => post(`/api/campaigns/${campaignId}/queue`, { password })}
          >
            <PlayCircle className="mr-2 h-4 w-4" />
            Enviar campanha
          </Button>
          <Button
            disabled={isLoading || !canPause}
            type="button"
            variant="secondary"
            onClick={() => post(`/api/campaigns/${campaignId}/pause`)}
          >
            <Pause className="mr-2 h-4 w-4" />
            Pausar
          </Button>
          <Button
            disabled={isLoading || !canRetryFailures}
            type="button"
            variant="secondary"
            onClick={() => post(`/api/campaigns/${campaignId}/retry-failures`)}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reenviar falhas
          </Button>
          <Button
            disabled={isLoading || !canCancel}
            type="button"
            variant="danger"
            onClick={() => post(`/api/campaigns/${campaignId}/cancel`)}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Cancelar
          </Button>
        </div>
      </form>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </div>
  );
}
