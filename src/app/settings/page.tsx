import { Settings2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { DomainRateLimitForm } from "@/app/settings/domain-rate-limit-form";
import { SettingsForm } from "@/app/settings/settings-form";
import { requireCurrentUser } from "@/lib/auth/current-user";
import { listDomainRateLimits } from "@/services/admin/domain-rate-limit-service";
import { getSystemSettings } from "@/services/settings/settings-service";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireCurrentUser();
  const [settings, limits] = await Promise.all([getSystemSettings(), listDomainRateLimits()]);
  const canEdit = user.role === "ADMIN";

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-950">Configurações</h1>
        <p className="mt-1 text-sm text-muted-foreground">Parâmetros operacionais sem expor credenciais sensíveis.</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          <Settings2 className="h-4 w-4 text-teal-700" />
          <div>
            <h2 className="text-base font-semibold text-slate-950">Limites padrão</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Usados quando não existe regra específica por domínio.
            </p>
          </div>
        </CardHeader>
        <CardContent>
          <SettingsForm settings={settings} canEdit={canEdit} />
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <h2 className="text-base font-semibold text-slate-950">Limites por domínio</h2>
          <p className="mt-1 text-sm text-muted-foreground">Atualize ou crie regras de envio. O delay é informado em segundos.</p>
        </CardHeader>
        <CardContent>
          {canEdit ? (
            <DomainRateLimitForm
              limits={limits.map((limit) => ({
                id: limit.id,
                domain: limit.domain,
                messagesPerMinute: limit.messagesPerMinute,
                delayMs: limit.delayMs,
                active: limit.active
              }))}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Seu perfil atual não possui permissão para alterar limites por domínio.</p>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
