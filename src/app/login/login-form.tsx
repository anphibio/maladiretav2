"use client";

import { useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import { Lock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    const result = (await response.json().catch(() => null)) as {
      message?: string;
      redirectTo?: string;
    } | null;

    setIsLoading(false);

    if (!response.ok) {
      setError(result?.message ?? "Não foi possível autenticar.");
      return;
    }

    router.push(result?.redirectTo ?? "/dashboard");
    router.refresh();
  }

  function handlePasswordKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter" || isLoading || !username || !password) {
      return;
    }

    event.preventDefault();
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-800">Usuário institucional</label>
        <div className="flex rounded-md border border-border bg-white focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
          <div className="relative min-w-0 flex-1">
            <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              autoComplete="username"
              className="border-0 pl-9 focus:border-0 focus:ring-0"
              placeholder="usuario"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
            />
          </div>
          <div className="flex items-center border-l border-border bg-slate-50 px-3 text-sm font-medium text-slate-700">
            @tceal.tc.br
          </div>
        </div>
      </div>
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-800">Senha</label>
        <div className="relative">
          <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            autoComplete="current-password"
            className="pl-9"
            placeholder="Digite sua senha"
            type="password"
            value={password}
            onKeyDown={handlePasswordKeyDown}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
      </div>
      {error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      ) : null}
      <Button className="w-full" disabled={isLoading || !username || !password} type="submit">
        {isLoading ? "Validando acesso..." : "Entrar"}
      </Button>
    </form>
  );
}
