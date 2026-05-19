import Link from "next/link";
import Image from "next/image";
import { BarChart3, FileText, LayoutDashboard, Mail, Settings, Users } from "lucide-react";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/campaigns", label: "Campanhas", icon: Mail },
  { href: "/admin", label: "Administração", icon: Users },
  { href: "/logs", label: "Logs", icon: FileText },
  { href: "/settings", label: "Configurações", icon: Settings }
];

export function Sidebar() {
  return (
    <aside className="hidden min-h-screen w-72 border-r border-border bg-white lg:block">
      <div className="flex h-16 items-center gap-3 border-b border-border px-6">
        <Image
          alt="TCE-AL"
          className="h-10 w-10 object-contain"
          height={548}
          src="/brand/logo-tceal-vertical.png"
          width={592}
        />
        <div>
          <p className="text-sm font-semibold text-slate-950">Mala Direta</p>
          <p className="text-xs text-muted-foreground">TCE-AL</p>
        </div>
      </div>
      <nav className="space-y-1 px-3 py-4">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-950"
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="mx-6 mt-4 rounded-lg bg-slate-50 p-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
          <BarChart3 className="h-4 w-4" />
          Fila monitorada
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          Envios controlados por fila, limite global e limite por domínio.
        </p>
      </div>
    </aside>
  );
}
