# Sistema de Mala Direta TCE-AL

Sistema institucional de mala direta integrado ao Zimbra, com autenticação pelo e-mail institucional, campanhas auditáveis, fila de envio, rate limit por domínio e dashboards administrativos.

## Tecnologias

- Next.js, React, TypeScript e TailwindCSS
- Prisma ORM e PostgreSQL
- Redis e BullMQ
- Nodemailer para integração SMTP com Zimbra
- Zod para validação
- Recharts para dashboards
- Docker e Docker Compose

## Requisitos

- Docker e Docker Compose para produção ou QNAP
- Node.js 22+ para desenvolvimento local sem Docker
- PostgreSQL 16+ e Redis 7+ quando rodar localmente fora do Compose de produção
- Acesso ao servidor Zimbra institucional

## Configuração local

1. Instale as dependências:

```bash
npm install
```

2. Crie o arquivo de ambiente:

```bash
cp .env.example .env
```

3. Preencha as variáveis do Zimbra no `.env` e troque os segredos por valores longos e aleatórios. Não coloque credenciais reais no código-fonte.

4. Configure o primeiro administrador:

```env
BOOTSTRAP_ADMIN_EMAILS="seu.usuario@tceal.tc.br"
```

Quando esse usuário autenticar com sucesso no Zimbra, ele será criado/atualizado como `ADMIN`.

5. Suba PostgreSQL e Redis:

```bash
docker compose up -d postgres redis
```

Se aparecer erro de permissão no Docker, abra o Docker Desktop, aguarde o serviço iniciar e teste:

```bash
docker info
```

PostgreSQL e Redis precisam estar ouvindo em `localhost:5432` e `localhost:6379`.

6. Gere o Prisma Client e execute a primeira migration:

```bash
npm run prisma:generate
npm run prisma:migrate
```

7. Rode a aplicação:

```bash
npm run dev
```

8. Em outro terminal, rode o worker da fila:

```bash
npm run queue:worker
```

## Produção com Docker Compose

O arquivo `docker-compose.prod.yml` sobe a aplicação completa em containers:

- `postgres`: banco PostgreSQL;
- `redis`: Redis usado pelo BullMQ e pelas credenciais temporárias;
- `migrate`: executa `prisma migrate deploy`;
- `web`: aplicação Next.js;
- `worker`: consumidor BullMQ responsável por envios e checagem automática de bounces.

Esse é o fluxo recomendado para QNAP, porque evita depender de Node.js ou npm instalados no sistema do NAS.

1. Clone ou atualize o repositório:

```bash
cd /share/Container
git clone git@github.com:anphibio/maladiretav2.git maladiretav2
cd /share/Container/maladiretav2
```

Para atualizar uma pasta já existente:

```bash
git fetch origin main
git reset --hard origin/main
```

2. Crie o `.env`:

```bash
cp .env.example .env
```

Edite o arquivo e configure pelo menos:

```env
APP_ENV="production"
APP_URL="http://IP_OU_HOST_DO_QNAP:3000"
DATABASE_URL="postgresql://maladireta:maladireta@postgres:5432/maladireta"
REDIS_URL="redis://redis:6379"
ZIMBRA_SMTP_HOST="smtp.tceal.tc.br"
ZIMBRA_IMAP_HOST="smtp.tceal.tc.br"
SESSION_SECRET="troque-por-um-valor-longo-e-aleatorio"
JWT_SECRET="troque-por-outro-valor-longo-e-aleatorio"
CREDENTIAL_ENCRYPTION_SECRET="troque-por-um-segredo-longo-para-credenciais"
QUEUE_DISPATCH_ENABLED="true"
BOOTSTRAP_ADMIN_EMAILS="seu.usuario@tceal.tc.br"
```

Use `APP_URL` com `http://` quando acessar direto pelo IP e porta do QNAP. Se a aplicação ficar atrás de proxy HTTPS, troque para `https://...`; essa configuração define se o cookie de sessão será marcado como seguro.

3. Suba todos os serviços:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

O serviço `migrate` roda automaticamente antes do `web` e do `worker`.

4. Verifique o estado:

```bash
docker compose -f docker-compose.prod.yml ps
```

5. Consulte logs:

```bash
docker compose -f docker-compose.prod.yml logs -f web
docker compose -f docker-compose.prod.yml logs -f worker
docker compose -f docker-compose.prod.yml logs migrate
```

6. Reinicie após alterações:

```bash
git fetch origin main
git reset --hard origin/main
docker compose -f docker-compose.prod.yml up -d --build
```

Sem o container `worker`, campanhas podem ficar aguardando envio e bounces não serão processados.

## Rotas iniciais

- `/login`: tela de autenticação institucional
- `/dashboard`: métricas e gráficos operacionais
- `/campaigns`: base de gerenciamento de campanhas
- `/admin`: painel administrativo
- `/logs`: auditoria e eventos
- `/settings`: limites e parâmetros operacionais
- `/api/health`: verificação simples da aplicação

## API externa para envio de e-mails

Administradores podem criar aplicações externas em `/admin`. Cada aplicação possui:

- nome e descrição;
- remetente institucional próprio;
- senha do Zimbra validada e armazenada criptografada;
- tokens `AppToken` revogáveis.

O token completo aparece apenas no momento da geração. O banco armazena somente o hash do token e um prefixo para identificação.

As rotas versionadas ficam em `/api/v1` e usam:

```txt
Authorization: AppToken app_xxxxxxxxx
```

Enviar um e-mail:

```bash
curl -X POST "$APP_URL/api/v1/emails/send" \
  -H "Authorization: AppToken app_xxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{
    "toEmail": "destinatario@exemplo.com",
    "subject": "Comunicado",
    "body": "Mensagem enviada por sistema externo",
    "externalReferenceId": "sistema-123"
  }'
```

Enviar em lote:

```json
[
  {
    "toEmail": "a@exemplo.com",
    "subject": "Comunicado",
    "htmlBody": "<p>Mensagem A</p>",
    "textBody": "Mensagem A"
  },
  {
    "toEmail": "b@exemplo.com",
    "subject": "Comunicado",
    "body": "Mensagem B"
  }
]
```

Consultar a fila da aplicação autenticada:

```txt
GET /api/v1/emails/queue?page=1&pageSize=50
```

Consultar status:

```txt
GET /api/v1/emails/status/{id}
```

O status também retorna os eventos recentes da tarefa. Os estados possíveis são `QUEUED`, `SENDING`, `SENT`, `FAILED` e `BOUNCED`.

Os envios via API usam uma fila BullMQ separada (`api-email`) e respeitam os limites globais configurados em `/settings`: delay mínimo, delay máximo, pausa periódica e limite por hora. O worker precisa estar ativo para disparar os e-mails.

A área administrativa mostra os logs das aplicações externas com filtros por aplicação, status e busca textual. Esses logs registram criação na fila, início de envio, entrega SMTP, falhas e bounces.

Para manter o banco enxuto, os logs e tarefas da API externa têm retenção de 30 dias. Configure um agendamento diário chamando:

```txt
POST /api/cron/api-email-retention
Header: x-cron-secret: valor-do-CRON_SECRET
```

## Login institucional

Na tela de login, o usuário informa apenas o nome da conta. O domínio `@tceal.tc.br` é fixo na interface e o backend monta o e-mail institucional antes de validar no Zimbra.

Exemplo:

```txt
Campo usuário: joao.silva
E-mail validado: joao.silva@tceal.tc.br
```

Após autenticação válida, o sistema cria uma sessão local assinada em cookie `httpOnly` e registra logs de acesso e auditoria. A senha do Zimbra não é gravada no PostgreSQL; ela fica temporariamente criptografada no Redis para envio e checagem automática de bounces.

## Campanhas

A página `/campaigns` já lista campanhas reais do banco respeitando o perfil do usuário. Operadores visualizam apenas as próprias campanhas; administradores e auditores podem visualizar a base completa.

Ao criar uma campanha, o formulário aceita destinatários por CSV, XLSX, TXT ou preenchimento manual, anexos, corpo em texto puro ou editor visual HTML, e três ações:

- salvar como rascunho;
- agendar para data e hora futuras;
- enviar/preparar a fila imediatamente.

O remetente é definido no backend a partir da sessão autenticada:

```txt
Usuário logado: joao.silva@tceal.tc.br
Remetente gravado na campanha: joao.silva@tceal.tc.br
```

Não existe campo de edição manual do remetente.

Campanhas agendadas ficam com status `Agendado` e aparecem com a data/hora na listagem e no detalhe. Para processar campanhas cujo horário chegou, configure `CRON_SECRET` no `.env` e chame periodicamente:

```txt
POST /api/cron/scheduled-campaigns
Header: x-cron-secret: valor-do-CRON_SECRET
```

Esse processamento prepara a fila respeitando os limites por domínio. Se o disparo automático estiver ativado (`QUEUE_DISPATCH_ENABLED="true"`), a fila continua exigindo credencial temporária do Zimbra para envio efetivo.

Na tela de detalhe da campanha, o sistema permite:

- editar nome, assunto e conteúdo enquanto estiver em rascunho;
- pausar campanhas em fila ou enviando;
- cancelar campanhas ainda não finalizadas;
- marcar destinatários com falha para reenvio;
- preparar novamente a fila após reenvio de falhas.

Todas as transições validam status e permissão no backend e registram auditoria.

## Importação de destinatários

A tela de detalhe da campanha, em `/campaigns/[id]`, permite importar destinatários em campanhas com status de rascunho.

Formatos aceitos:

- CSV
- XLSX

Campos mínimos:

```txt
email,nome
```

Campos opcionais:

```txt
cpf,setor,cargo,orgao,cidade,estado,tags
```

Durante a importação, o sistema valida e-mails, remove duplicados dentro do arquivo, identifica o domínio de destino, grava destinatários válidos, cria um lote de importação e registra erros por linha.

## Teste e preparação da fila

A tela de detalhe da campanha permite enviar um e-mail de teste informando a senha do Zimbra naquele momento. Essa senha não é armazenada.

Também é possível preparar a fila da campanha. Essa ação cria um `email_job` por destinatário, calcula atrasos por domínio e muda a campanha para `Em fila`.

Os envios são distribuídos pela fila com os limites padrão abaixo:

- delay mínimo de 20 segundos entre mensagens;
- delay máximo de 45 segundos entre mensagens;
- pausa a cada 25 envios;
- duração da pausa de 300 segundos;
- limite de 90 envios por hora.

Domínios Microsoft (`outlook.com`, `hotmail.com`, `live.com` e `msn.com`) mantêm tratamento diferenciado e mais cauteloso: no mínimo 60 segundos entre mensagens, pausa a cada 15 envios, pausa de 600 segundos e limite de 60 envios por hora.

Por segurança, o disparo automático para o BullMQ fica desativado por padrão:

```env
QUEUE_DISPATCH_ENABLED="false"
```

Quando essa opção estiver `true`, a preparação da fila usa a credencial temporária validada no login. Se uma senha for informada novamente no formulário de envio, ela é revalidada no Zimbra e substitui a credencial temporária da campanha. A senha é criptografada com AES-GCM usando chave derivada de `SESSION_SECRET`, guardada temporariamente no Redis com expiração e usada pelo worker para os envios SMTP.

A senha não é gravada no PostgreSQL nem em logs. Ao final dos jobs pendentes da campanha, a credencial temporária é removida do Redis.

## Checagem de bounces

O sistema marca falhas posteriores ao envio quando recebe mensagens de retorno na caixa do usuário logado ou no remetente de uma aplicação externa. Cada e-mail enviado pela fila de campanha recebe os cabeçalhos `X-Campaign-Id` e `X-Recipient-Id`; cada e-mail enviado pela API externa recebe `X-Api-Email-Task-Id` e, quando informado, `X-External-Reference-Id`.

Configure apenas a pasta IMAP a ser lida:

```env
BOUNCE_IMAP_MAILBOX="INBOX"
```

Quando a campanha termina de enviar, o worker agenda automaticamente checagens IMAP usando a mesma credencial temporária validada no login ou no disparo SMTP da campanha. Para aplicações externas, o worker usa a credencial protegida salva na própria aplicação. Essas checagens rodam em segundo plano e atualizam os logs com status `BOUNCED` quando encontram retornos.

A guia Logs não solicita senha IMAP nem oferece checagem manual. A rotina automática usa a credencial temporária da sessão e mantém a senha fora do PostgreSQL e dos logs.

A rotina lê mensagens não vistas, detecta DSN/bounces, marca o destinatário como `Falhou` em campanhas, registra `BOUNCED` nos logs de envio e reavalia o status da campanha. Para tarefas da API externa, o mesmo bounce altera a tarefa para `BOUNCED` e cria o evento correspondente na área de logs das aplicações.

## Administração

A página `/admin` é restrita a usuários com perfil `ADMIN`.

Funcionalidades disponíveis nesta etapa:

- resumo de jobs aguardando, ativos e com falha;
- criação ou atualização de limites por domínio;
- gerenciamento de usuários autorizados;
- alteração de perfil `ADMIN`, `OPERATOR` ou `AUDITOR`;
- ativação e desativação de usuários;
- inicialização automática dos domínios sensíveis `outlook.com`, `hotmail.com`, `live.com` e `msn.com`;
- auditoria `ADMIN_CHANGED` quando um limite é alterado.

Operadores e auditores visualizam uma mensagem de acesso restrito.

O sistema não cria nem armazena senha local para usuários. A autorização administrativa altera apenas perfil e status; a autenticação continua sendo feita pelo Zimbra.

## Logs e auditoria

A página `/logs` consulta registros reais do banco e separa os eventos em:

- auditoria (`audit_logs`);
- acessos (`access_logs`);
- envios (`email_logs`).

Administradores e auditores visualizam todos os registros. Operadores visualizam apenas registros associados ao próprio usuário, e-mail remetente ou sessão.

A API `/api/logs` aceita filtros simples:

```txt
/api/logs?type=audit&q=LOGIN&limit=50
/api/logs?type=access&q=usuario@tceal.tc.br
/api/logs?type=email&q=FAILED
```

## Relatórios CSV

A API `/api/reports` exporta relatórios em CSV, sempre respeitando o perfil do usuário autenticado.

Tipos disponíveis:

```txt
/api/reports?type=campaigns
/api/reports?type=failures
/api/reports?type=access
/api/reports?type=audit
```

Também aceita filtros:

```txt
/api/reports?type=audit&q=LOGIN&limit=1000
```

Toda exportação registra auditoria `REPORT_EXPORTED`.

## Dashboard

A página `/dashboard` usa dados reais do banco para exibir:

- total de campanhas;
- e-mails enviados;
- falhas;
- campanhas agendadas;
- taxa de sucesso;
- jobs aguardando;
- jobs com falha;
- envios e falhas por dia;
- falhas por domínio;
- campanhas recentes.

Operadores visualizam apenas seus próprios dados. Administradores e auditores visualizam o consolidado geral.

## Configurações

A página `/settings` persiste parâmetros operacionais na tabela `settings`.

Configurações disponíveis:

- limite padrão de e-mails por minuto;
- delay padrão entre mensagens;
- máximo de destinatários por campanha;
- envio automático de jobs para o BullMQ.

Administradores podem alterar os valores. Outros perfis podem consultar. A preparação da fila usa os valores persistidos no banco e só recorre ao `.env` para inicializar padrões.

## Segurança

- A senha do Zimbra não deve ser armazenada no banco.
- O remetente das campanhas deve ser sempre o usuário autenticado.
- Logs de auditoria não devem ser apagáveis pela interface.
- Credenciais, hosts internos e segredos devem ficar somente em variáveis de ambiente.
- APIs críticas devem aplicar validação, autorização, rate limit e logs.

## Próximas etapas técnicas

1. Implementar autenticação real via Zimbra com sessão local segura.
2. Criar APIs de campanhas, destinatários e importação CSV/XLSX.
3. Persistir jobs no banco e enfileirar envios no BullMQ.
4. Implementar rate limit por domínio no worker.
5. Conectar dashboards e tabelas aos dados reais.
6. Implementar exportações CSV/XLSX/PDF.
