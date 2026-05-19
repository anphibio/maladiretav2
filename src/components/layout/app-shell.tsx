import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="flex">
        <Sidebar />
        <main className="min-w-0 flex-1">
          <Header />
          <div className="px-4 py-6 md:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
