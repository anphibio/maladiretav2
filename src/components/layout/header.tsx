import Image from "next/image";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { LogoutButton } from "@/components/layout/logout-button";

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-border bg-white px-4 md:px-8">
      <div className="flex items-center gap-3">
        <Image
          alt="TCE-AL"
          className="hidden h-9 w-auto sm:block"
          height={166}
          src="/brand/logo-tceal-horizontal.png"
          width={512}
        />
        <div>
          <p className="text-sm font-medium text-slate-950">Sistema de Mala Direta</p>
          <p className="text-xs text-muted-foreground">Ambiente institucional auditável</p>
        </div>
      </div>
      <div className="hidden w-full max-w-sm items-center gap-2 md:flex">
        <Search className="h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar campanhas, logs ou usuários" />
      </div>
      <LogoutButton />
    </header>
  );
}
