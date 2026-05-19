import { ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DomainRateLimitForm } from "@/app/admin/domain-rate-limit-form";
import { UserManagementTable } from "@/app/admin/user-management-table";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { listDomainRateLimits } from "@/services/admin/domain-rate-limit-service";
import { getQueueStatusSummary } from "@/services/admin/queue-status-service";
import { listManagedUsers } from "@/services/admin/user-admin-service";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await requireCurrentUser();

  if (user.role !== "ADMIN") {
    return (
      <AppShell>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-slate-950">Administração</h1>
          <p className="mt-1 text-sm text-muted-foreground">Acesso restrito a administradores.</p>
        </div>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-slate-800">
              <ShieldCheck className="h-5 w-5 text-red-600" />
              Seu perfil atual não possui permissão para alterar configurações administrativas.
            </div>
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const [limits, queueStatus, users] = await Promise.all([
    listDomainRateLimits(),
    getQueueStatusSummary(),
    listManagedUsers()
  ]);
  const metrics = [
    { title: "Jobs aguardando", value: queueStatus.waiting, icon: SlidersHorizontal },
    { title: "Jobs ativos", value: queueStatus.active, icon: Users },
    { title: "Jobs com falha", value: queueStatus.failed, icon: ShieldCheck }
  ];

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-950">Administração</h1>
        <p className="mt-1 text-sm text-muted-foreground">Controle operacional para administradores autorizados.</p>
      </div>
      <div className="mb-6 grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card key={metric.title}>
              <CardContent className="flex items-center justify-between p-5">
                <div>
                  <p className="text-sm text-muted-foreground">{metric.title}</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950">{metric.value}</p>
                </div>
                <Icon className="h-5 w-5 text-teal-700" />
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-slate-950">Limites por domínio</h2>
          <p className="mt-1 text-sm text-muted-foreground">Atualize ou crie regras de envio. O delay é informado em segundos.</p>
        </CardHeader>
        <CardContent>
          <DomainRateLimitForm
            limits={limits.map((limit) => ({
              id: limit.id,
              domain: limit.domain,
              messagesPerMinute: limit.messagesPerMinute,
              delayMs: limit.delayMs,
              active: limit.active
            }))}
          />
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <h2 className="text-base font-semibold text-slate-950">Usuários autorizados</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie perfil e status de usuários autenticados pelo Zimbra.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <UserManagementTable users={users} currentUserId={user.id} />
        </CardContent>
      </Card>
    </AppShell>
  );
}
