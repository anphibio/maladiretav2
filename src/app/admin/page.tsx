import { Mail, PlugZap, ShieldCheck, SlidersHorizontal, Users } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ApplicationLogs } from "@/app/admin/application-logs";
import { ApplicationManagement } from "@/app/admin/application-management";
import { UserManagementTable } from "@/app/admin/user-management-table";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { listApplicationsForAdmin } from "@/services/api-email/api-application-service";
import { listApiEmailLogs } from "@/services/api-email/api-email-service";
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

  const [queueStatus, users, applications, apiEmailLogs] = await Promise.all([
    getQueueStatusSummary(),
    listManagedUsers(),
    listApplicationsForAdmin(),
    listApiEmailLogs({ page: 1, pageSize: 50 })
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
          <div className="flex items-center gap-2">
            <PlugZap className="h-4 w-4 text-teal-700" />
            <div>
              <h2 className="text-base font-semibold text-slate-950">Aplicações externas</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Gerencie sistemas autorizados, tokens e credenciais protegidas por aplicação.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ApplicationManagement
            applications={applications.map((application) => ({
              id: application.id,
              name: application.name,
              description: application.description,
              senderEmail: application.senderEmail,
              encryptedPassword: application.encryptedPassword,
              isActive: application.isActive,
              tokens: application.tokens.map((token) => ({
                id: token.id,
                tokenPrefix: token.tokenPrefix,
                revokedAt: token.revokedAt,
                lastUsedAt: token.lastUsedAt,
                createdAt: token.createdAt
              })),
              _count: application._count
            }))}
          />
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-teal-700" />
            <div>
              <h2 className="text-base font-semibold text-slate-950">Logs das aplicações externas</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Histórico operacional das aplicações externas, incluindo envio, falha e bounce.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ApplicationLogs
            applications={applications.map((application) => ({
              id: application.id,
              name: application.name
            }))}
            initialResult={{
              page: apiEmailLogs.page,
              pageSize: apiEmailLogs.pageSize,
              total: apiEmailLogs.total,
              retentionDays: apiEmailLogs.retentionDays,
              items: apiEmailLogs.items.map((item) => ({
                id: item.id,
                applicationId: item.applicationId,
                applicationName: item.applicationName,
                recipientEmail: item.recipientEmail,
                senderEmail: item.senderEmail,
                status: item.status,
                externalReferenceId: item.externalReferenceId,
                message: item.message,
                smtpResponse: item.smtpResponse,
                attempts: item.attempts,
                updatedAt: item.updatedAt.toISOString(),
                createdAt: item.createdAt.toISOString()
              }))
            }}
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
