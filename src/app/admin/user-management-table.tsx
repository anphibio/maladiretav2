"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { Button } from "@/components/ui/button";

type ManagedUser = {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  active: boolean;
  lastLoginAt: Date | null;
  _count: {
    campaigns: number;
    auditLogs: number;
  };
};

function formatDate(date: Date | null): string {
  if (!date) {
    return "-";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short"
  }).format(new Date(date));
}

export function UserManagementTable({
  users,
  currentUserId
}: {
  users: ManagedUser[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [loadingUserId, setLoadingUserId] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>, userId: string) {
    event.preventDefault();
    setMessage(null);
    setLoadingUserId(userId);

    const formData = new FormData(event.currentTarget);
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        role: String(formData.get("role") ?? "OPERATOR"),
        active: formData.get("active") === "on"
      })
    });
    const result = (await response.json().catch(() => null)) as { message?: string } | null;

    setLoadingUserId(null);

    if (!response.ok) {
      setMessage(result?.message ?? "Não foi possível atualizar o usuário.");
      return;
    }

    setMessage("Usuário atualizado com sucesso.");
    router.refresh();
  }

  return (
    <div>
      {message ? <p className="mb-4 text-sm text-muted-foreground">{message}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="border-b border-border bg-slate-50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-5 py-3">Usuário</th>
              <th className="px-5 py-3">Perfil</th>
              <th className="px-5 py-3">Ativo</th>
              <th className="px-5 py-3">Campanhas</th>
              <th className="px-5 py-3">Último login</th>
              <th className="px-5 py-3">Ação</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td className="px-5 py-8 text-center text-muted-foreground" colSpan={6}>
                  Nenhum usuário registrado.
                </td>
              </tr>
            ) : null}
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border last:border-0">
                <td className="px-5 py-4">
                  <p className="font-medium text-slate-900">{user.name ?? user.email}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </td>
                <td className="px-5 py-4">
                  <form className="contents" id={`user-form-${user.id}`} onSubmit={(event) => handleSubmit(event, user.id)}>
                    <select
                      className="h-9 rounded-md border border-border bg-white px-2 text-sm"
                      defaultValue={user.role}
                      disabled={loadingUserId === user.id}
                      name="role"
                    >
                      <option value="ADMIN">Administrador</option>
                      <option value="OPERATOR">Operador</option>
                      <option value="AUDITOR">Auditor</option>
                    </select>
                  </form>
                </td>
                <td className="px-5 py-4">
                  <label className="inline-flex items-center gap-2 text-sm text-slate-800">
                    <input
                      className="h-4 w-4"
                      defaultChecked={user.active}
                      disabled={loadingUserId === user.id}
                      form={`user-form-${user.id}`}
                      name="active"
                      type="checkbox"
                    />
                    {user.active ? "Sim" : "Não"}
                  </label>
                </td>
                <td className="px-5 py-4 text-muted-foreground">{user._count.campaigns}</td>
                <td className="px-5 py-4 text-muted-foreground">{formatDate(user.lastLoginAt)}</td>
                <td className="px-5 py-4">
                  <Button
                    className="h-8 px-3"
                    disabled={loadingUserId === user.id || user.id === currentUserId}
                    form={`user-form-${user.id}`}
                  >
                    {loadingUserId === user.id ? "Salvando..." : "Salvar"}
                  </Button>
                  {user.id === currentUserId ? <p className="mt-1 text-xs text-muted-foreground">Usuário atual</p> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
