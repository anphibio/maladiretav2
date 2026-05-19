"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    setIsLoading(true);

    const response = await fetch("/api/auth/logout", {
      method: "POST"
    });
    const result = (await response.json().catch(() => null)) as { redirectTo?: string } | null;

    router.push(result?.redirectTo ?? "/login");
    router.refresh();

    if (!response.ok) {
      setIsLoading(false);
    }
  }

  return (
    <button
      className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
      disabled={isLoading}
      type="button"
      onClick={handleLogout}
    >
      <LogOut className="h-4 w-4" />
      {isLoading ? "Saindo..." : "Sair"}
    </button>
  );
}
