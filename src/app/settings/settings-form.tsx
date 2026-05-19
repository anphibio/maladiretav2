"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SystemSettingsInput } from "@/features/settings/schemas";

function msToSeconds(value: number): number {
  return Math.round(value / 1000);
}

function secondsToMs(value: FormDataEntryValue | null): number {
  return Number(value ?? 0) * 1000;
}

export function SettingsForm({
  settings,
  canEdit
}: {
  settings: SystemSettingsInput;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canEdit) {
      return;
    }

    setMessage(null);
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        defaultMinEmailDelayMs: secondsToMs(formData.get("defaultMinEmailDelaySeconds")),
        defaultMaxEmailDelayMs: secondsToMs(formData.get("defaultMaxEmailDelaySeconds")),
        defaultPauseEveryEmails: Number(formData.get("defaultPauseEveryEmails") ?? 0),
        defaultPauseDurationMs: secondsToMs(formData.get("defaultPauseDurationSeconds")),
        defaultHourlyEmailLimit: Number(formData.get("defaultHourlyEmailLimit") ?? 0),
        maxRecipientsPerCampaign: Number(formData.get("maxRecipientsPerCampaign") ?? 0),
        queueDispatchEnabled: formData.get("queueDispatchEnabled") === "on"
      })
    });
    const result = (await response.json().catch(() => null)) as { message?: string } | null;

    setIsLoading(false);

    if (!response.ok) {
      setMessage(result?.message ?? "Não foi possível salvar as configurações.");
      return;
    }

    setMessage("Configurações salvas com sucesso.");
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="text-sm font-medium text-slate-800">
          Delay mínimo (s)
          <Input
            className="mt-2"
            defaultValue={msToSeconds(settings.defaultMinEmailDelayMs)}
            disabled={!canEdit}
            min={0}
            name="defaultMinEmailDelaySeconds"
            required
            type="number"
          />
        </label>
        <label className="text-sm font-medium text-slate-800">
          Delay máximo (s)
          <Input
            className="mt-2"
            defaultValue={msToSeconds(settings.defaultMaxEmailDelayMs)}
            disabled={!canEdit}
            min={0}
            name="defaultMaxEmailDelaySeconds"
            required
            type="number"
          />
        </label>
        <label className="text-sm font-medium text-slate-800">
          Pausa a cada
          <Input
            className="mt-2"
            defaultValue={settings.defaultPauseEveryEmails}
            disabled={!canEdit}
            min={1}
            name="defaultPauseEveryEmails"
            required
            type="number"
          />
        </label>
        <label className="text-sm font-medium text-slate-800">
          Duração da pausa (s)
          <Input
            className="mt-2"
            defaultValue={msToSeconds(settings.defaultPauseDurationMs)}
            disabled={!canEdit}
            min={0}
            name="defaultPauseDurationSeconds"
            required
            type="number"
          />
        </label>
        <label className="text-sm font-medium text-slate-800">
          Limite por hora
          <Input
            className="mt-2"
            defaultValue={settings.defaultHourlyEmailLimit}
            disabled={!canEdit}
            min={1}
            name="defaultHourlyEmailLimit"
            required
            type="number"
          />
        </label>
        <label className="text-sm font-medium text-slate-800">
          Máximo por campanha
          <Input
            className="mt-2"
            defaultValue={settings.maxRecipientsPerCampaign}
            disabled={!canEdit}
            min={1}
            name="maxRecipientsPerCampaign"
            required
            type="number"
          />
        </label>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
        <input
          className="h-4 w-4"
          defaultChecked={settings.queueDispatchEnabled}
          disabled={!canEdit}
          name="queueDispatchEnabled"
          type="checkbox"
        />
        Enviar jobs automaticamente para o BullMQ
      </label>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
      {canEdit ? (
        <Button disabled={isLoading}>
          <Save className="mr-2 h-4 w-4" />
          {isLoading ? "Salvando..." : "Salvar configurações"}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">Seu perfil permite consulta, mas não alteração destas configurações.</p>
      )}
    </form>
  );
}
