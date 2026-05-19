"use client";

import { useState, type FormEvent } from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BounceCheckForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/bounces", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        password: String(formData.get("password") ?? "")
      })
    });
    const result = (await response.json().catch(() => null)) as {
      message?: string;
      processed?: number;
      registered?: number;
    } | null;

    setIsLoading(false);

    if (!response.ok) {
      setMessage(result?.message ?? "Não foi possível checar retornos.");
      return;
    }

    setMessage(`${result?.registered ?? 0} bounce(s) registrado(s) em ${result?.processed ?? 0} mensagem(ns) analisada(s).`);
    event.currentTarget.reset();
  }

  return (
    <form className="flex w-full flex-col gap-2 rounded-md border border-border bg-slate-50 p-3 md:w-auto md:min-w-[420px]" onSubmit={handleSubmit}>
      <div className="flex gap-2">
        <Input className="bg-white" name="password" placeholder="Senha para checar retornos IMAP" required type="password" />
        <Button disabled={isLoading}>
          <RotateCw className="mr-2 h-4 w-4" />
          {isLoading ? "Checando..." : "Checar bounces"}
        </Button>
      </div>
      {message ? <p className="text-xs text-muted-foreground">{message}</p> : null}
    </form>
  );
}
