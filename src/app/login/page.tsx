import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { LoginForm } from "@/app/login/login-form";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="flex items-center px-6 py-10 md:px-12">
        <div className="mx-auto w-full max-w-md">
          <div className="mb-8 flex items-center gap-4">
            <Image
              alt="TCE-AL - Tribunal de Contas do Estado de Alagoas"
              className="h-16 w-16 object-contain"
              height={548}
              priority
              src="/brand/logo-tceal-vertical.png"
              width={592}
            />
            <div>
              <h1 className="text-xl font-semibold text-slate-950">Mala Direta Institucional</h1>
              <p className="mt-1 text-sm text-muted-foreground">Acesso com credenciais institucionais</p>
            </div>
          </div>

          <Card className="shadow-soft">
            <CardContent className="p-6">
              <LoginForm />
            </CardContent>
          </Card>

          <p className="mt-4 text-xs leading-5 text-muted-foreground">
            A senha não é gravada no banco; fica temporariamente criptografada para envio e bounces automáticos.
          </p>
        </div>
      </section>
      <section className="hidden bg-slate-950 px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between">
        <div />
        <div className="max-w-xl">
          <p className="text-sm font-medium text-teal-200">Controle, auditoria e rastreabilidade</p>
          <h2 className="mt-3 text-4xl font-semibold leading-tight">
            Envio institucional com fila, limites por domínio e logs imutáveis.
          </h2>
          <p className="mt-5 max-w-lg text-sm leading-6 text-slate-300">
            Campanhas vinculadas ao usuário autenticado, acompanhamento operacional e relatórios para auditoria.
          </p>
        </div>
      </section>
    </main>
  );
}
