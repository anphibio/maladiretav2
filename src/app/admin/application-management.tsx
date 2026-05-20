"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Pencil, Save, ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ApplicationRow = {
  id: string;
  name: string;
  description: string | null;
  senderEmail: string;
  encryptedPassword: string | null;
  isActive: boolean;
  tokens: Array<{
    id: string;
    tokenPrefix: string;
    revokedAt: Date | null;
    lastUsedAt: Date | null;
    createdAt: Date;
  }>;
  _count: {
    emailTasks: number;
  };
};

function formatDate(date: Date | string | null): string {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(date));
}

export function ApplicationManagement({ applications }: { applications: ApplicationRow[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [plainToken, setPlainToken] = useState<string | null>(null);
  const [editing, setEditing] = useState<ApplicationRow | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);

  async function saveApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage(null);
    setPlainToken(null);
    setLoadingId("application");

    const formData = new FormData(form);
    const response = await fetch("/api/admin/applications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: editing?.id,
        name: String(formData.get("name") ?? ""),
        description: String(formData.get("description") ?? ""),
        senderEmail: String(formData.get("senderEmail") ?? ""),
        isActive: formData.get("isActive") === "on"
      })
    });
    const result = (await response.json().catch(() => null)) as { message?: string } | null;

    setLoadingId(null);

    if (!response.ok) {
      setMessage(result?.message ?? "Não foi possível salvar a aplicação.");
      return;
    }

    setMessage("Aplicação salva.");
    setEditing(null);
    form.reset();
    router.refresh();
  }

  async function saveCredential(event: FormEvent<HTMLFormElement>, applicationId: string) {
    event.preventDefault();
    const form = event.currentTarget;
    setMessage(null);
    setPlainToken(null);
    setLoadingId(`credential:${applicationId}`);

    const formData = new FormData(form);
    const response = await fetch(`/api/admin/applications/${applicationId}/credential`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        password: String(formData.get("password") ?? "")
      })
    });
    const result = (await response.json().catch(() => null)) as { message?: string } | null;

    setLoadingId(null);

    if (!response.ok) {
      setMessage(result?.message ?? "Não foi possível salvar a credencial.");
      return;
    }

    setMessage("Credencial validada e protegida.");
    form.reset();
    router.refresh();
  }

  async function generateToken(applicationId: string) {
    setMessage(null);
    setPlainToken(null);
    setLoadingId(`token:${applicationId}`);

    const response = await fetch(`/api/admin/applications/${applicationId}/tokens`, {
      method: "POST"
    });
    const result = (await response.json().catch(() => null)) as {
      message?: string;
      plainToken?: string;
    } | null;

    setLoadingId(null);

    if (!response.ok || !result?.plainToken) {
      setMessage(result?.message ?? "Não foi possível gerar o token.");
      return;
    }

    setPlainToken(result.plainToken);
    setMessage("Token gerado. Copie agora; ele não será exibido novamente.");
    router.refresh();
  }

  async function revokeToken(applicationId: string, tokenId: string) {
    setMessage(null);
    setPlainToken(null);
    setLoadingId(`revoke:${tokenId}`);

    const response = await fetch(`/api/admin/applications/${applicationId}/revoke-token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ tokenId })
    });
    const result = (await response.json().catch(() => null)) as { message?: string } | null;

    setLoadingId(null);

    if (!response.ok) {
      setMessage(result?.message ?? "Não foi possível revogar o token.");
      return;
    }

    setMessage("Token revogado.");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <form className="grid gap-4 md:grid-cols-[1fr_1fr_1.4fr_120px] md:items-end" onSubmit={saveApplication}>
        <label className="text-sm font-medium text-slate-800">
          Nome
          <Input className="mt-2" defaultValue={editing?.name ?? ""} name="name" placeholder="Sistema externo" required />
        </label>
        <label className="text-sm font-medium text-slate-800">
          Remetente
          <Input className="mt-2" defaultValue={editing?.senderEmail ?? ""} name="senderEmail" placeholder="usuario@tceal.tc.br" required type="email" />
        </label>
        <label className="text-sm font-medium text-slate-800">
          Descrição
          <Input className="mt-2" defaultValue={editing?.description ?? ""} name="description" placeholder="Origem dos envios" />
        </label>
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-800">
            <input className="h-4 w-4" defaultChecked={editing?.isActive ?? true} name="isActive" type="checkbox" />
            Ativa
          </label>
          <Button className="w-full" disabled={loadingId === "application"}>
            <Save className="mr-2 h-4 w-4" />
            Salvar
          </Button>
        </div>
        {message ? <p className="text-sm text-muted-foreground md:col-span-4">{message}</p> : null}
        {plainToken ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 md:col-span-4">
            <p className="font-semibold">Token da aplicação</p>
            <code className="mt-2 block break-all rounded bg-white p-2">{plainToken}</code>
          </div>
        ) : null}
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="border-b border-border bg-slate-50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Aplicação</th>
              <th className="px-5 py-3">Remetente</th>
              <th className="px-5 py-3">Credencial</th>
              <th className="px-5 py-3">Tokens</th>
              <th className="px-5 py-3">Envios</th>
              <th className="px-5 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {applications.length === 0 ? (
              <tr>
                <td className="px-5 py-8 text-center text-muted-foreground" colSpan={6}>
                  Nenhuma aplicação registrada.
                </td>
              </tr>
            ) : null}
            {applications.map((application) => (
              <tr key={application.id} className="border-b border-border align-top last:border-0">
                <td className="px-5 py-4">
                  <p className="font-medium text-slate-900">{application.name}</p>
                  <p className="text-xs text-muted-foreground">{application.description ?? "-"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{application.isActive ? "Ativa" : "Inativa"}</p>
                </td>
                <td className="px-5 py-4 text-muted-foreground">{application.senderEmail}</td>
                <td className="px-5 py-4">
                  <p className="mb-2 text-xs text-muted-foreground">
                    {application.encryptedPassword ? "Configurada" : "Pendente"}
                  </p>
                  <form className="flex gap-2" onSubmit={(event) => saveCredential(event, application.id)}>
                    <Input className="h-9 min-w-48" name="password" placeholder="Senha do Zimbra" type="password" />
                    <Button className="h-9 px-3" disabled={loadingId === `credential:${application.id}`}>
                      Salvar
                    </Button>
                  </form>
                </td>
                <td className="px-5 py-4">
                  <div className="space-y-2">
                    {application.tokens.slice(0, 3).map((token) => (
                      <div key={token.id} className="rounded-md bg-slate-50 p-2">
                        <p className="font-mono text-xs text-slate-800">{token.tokenPrefix}...</p>
                        <p className="text-xs text-muted-foreground">
                          {token.revokedAt ? `Revogado em ${formatDate(token.revokedAt)}` : `Último uso: ${formatDate(token.lastUsedAt)}`}
                        </p>
                        {!token.revokedAt ? (
                          <Button
                            className="mt-2 h-8 px-2"
                            disabled={loadingId === `revoke:${token.id}`}
                            type="button"
                            variant="danger"
                            onClick={() => revokeToken(application.id, token.id)}
                          >
                            <ShieldOff className="mr-1 h-3.5 w-3.5" />
                            Revogar
                          </Button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </td>
                <td className="px-5 py-4 text-muted-foreground">{application._count.emailTasks}</td>
                <td className="px-5 py-4">
                  <div className="flex flex-col gap-2">
                    <Button className="h-9 px-3" type="button" variant="secondary" onClick={() => setEditing(application)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Editar
                    </Button>
                    <Button
                      className="h-9 px-3"
                      disabled={loadingId === `token:${application.id}`}
                      type="button"
                      onClick={() => generateToken(application.id)}
                    >
                      <KeyRound className="mr-2 h-4 w-4" />
                      Novo token
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
