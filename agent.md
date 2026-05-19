# agent.md — Agente para Criação de Sistema Profissional de Mala Direta do TCE-AL

## Objetivo do agente

Você é um agente especialista em desenvolvimento de sistemas web profissionais, seguros, auditáveis e escaláveis para ambiente institucional público.

Sua missão é criar um sistema de mala direta profissional para o TCE-AL, utilizando o Zimbra como servidor de e-mail.

O sistema deverá permitir o envio controlado de e-mails em massa, com autenticação integrada ao Zimbra, uso do próprio usuário autenticado como remetente, área administrativa, logs completos de auditoria e dashboards de monitoramento.

O resultado final deve ser um sistema robusto, seguro, rastreável e preparado para produção.

---

# Contexto institucional

O sistema será utilizado pelo TCE-AL.

O domínio institucional é:

```txt
tceal.tc.br
```

O servidor de e-mail utilizado é o Zimbra.

As informações de conexão do Zimbra deverão ser configuradas exclusivamente por variáveis de ambiente.

Nunca inserir credenciais, senhas, IPs sensíveis ou dados sigilosos diretamente no código-fonte.

---

# Stack recomendada

Utilizar preferencialmente:

## Frontend

- Next.js
- React
- TypeScript
- TailwindCSS
- Shadcn/UI
- Lucide Icons
- Recharts
- React Hook Form
- Zod

## Backend

- Node.js
- Next.js API Routes ou backend dedicado em Node.js
- Prisma ORM
- PostgreSQL
- Redis
- BullMQ
- Nodemailer

## Infraestrutura

- Docker
- Docker Compose
- Nginx ou proxy reverso equivalente
- Ambiente Linux em produção
- Deploy em servidor institucional ou infraestrutura homologada

---

# Regras gerais obrigatórias

- Criar código limpo, modular e profissional
- Utilizar TypeScript
- Separar responsabilidades por módulos
- Não criar arquivos gigantes
- Não duplicar lógica
- Não usar credenciais hardcoded
- Não armazenar senha do Zimbra em texto puro no banco
- Não permitir envio sem validação prévia
- Não permitir alteração manual do remetente
- Não permitir envio sem logs de auditoria
- Não disparar todos os e-mails de uma vez
- Implementar fila de envio
- Implementar rate limit por domínio
- Implementar logs de acesso e uso
- Implementar dashboards administrativos
- Priorizar segurança, rastreabilidade e confiabilidade

---

# Autenticação integrada ao Zimbra

O sistema não deverá possuir cadastro local de senha para os usuários.

O usuário deverá se autenticar utilizando suas credenciais do Zimbra.

Após autenticação bem-sucedida no Zimbra, o sistema deverá criar uma sessão local segura e associar o usuário autenticado ao seu e-mail institucional.

O mesmo usuário autenticado deverá ser utilizado como remetente das campanhas.

Exemplo:

```txt
Usuário logado: usuario@tceal.tc.br
Remetente da campanha: usuario@tceal.tc.br
```

## Regras de autenticação

- Validar login diretamente no Zimbra
- Permitir apenas usuários do domínio `tceal.tc.br`
- Não armazenar a senha do usuário no banco de dados
- Usar a senha apenas no momento da autenticação/envio, se tecnicamente necessário
- Preferir token, sessão segura ou mecanismo compatível com Zimbra quando disponível
- Criar sessão local segura após login válido
- Registrar logs de login
- Registrar logs de logout
- Registrar falhas de autenticação
- Registrar IP de origem
- Registrar user-agent
- Bloquear ou limitar tentativas inválidas
- Implementar expiração de sessão
- Implementar proteção contra brute force

---

# Uso do usuário autenticado como remetente

O envio de e-mail deverá utilizar o próprio usuário autenticado como remetente.

O sistema deve:

- Usar o e-mail do usuário logado como `from`
- Validar se o usuário pertence ao domínio autorizado
- Impedir alteração manual do remetente
- Vincular toda campanha ao usuário autenticado
- Registrar nos logs qual usuário realizou cada envio
- Registrar IP, data, hora e campanha vinculada
- Permitir auditoria completa por usuário remetente

O sistema não deve utilizar uma conta SMTP genérica para envio das campanhas, salvo para rotinas administrativas internas, notificações do sistema ou casos explicitamente autorizados.

---

# Variáveis de ambiente

Criar arquivo `.env.example` com as variáveis necessárias.

Exemplo:

```env
APP_NAME="Sistema de Mala Direta TCE-AL"
APP_URL="http://localhost:3000"
APP_ENV="development"

DATABASE_URL="postgresql://user:password@localhost:5432/maladireta"
REDIS_URL="redis://localhost:6379"

ZIMBRA_DOMAIN="tceal.tc.br"
ZIMBRA_SMTP_HOST=""
ZIMBRA_SMTP_PORT="587"
ZIMBRA_SMTP_SECURE="false"
ZIMBRA_IMAP_HOST=""
ZIMBRA_IMAP_PORT="993"
ZIMBRA_IMAP_SECURE="true"

SESSION_SECRET="change-me"
JWT_SECRET="change-me"

DEFAULT_EMAIL_RATE_LIMIT_PER_MINUTE="30"
DEFAULT_EMAIL_DELAY_MS="2000"
MAX_RECIPIENTS_PER_CAMPAIGN="5000"
```

---

# Módulos obrigatórios do sistema

## 1. Login e sessão

Criar tela de login profissional com:

- E-mail institucional
- Senha do Zimbra
- Validação do domínio
- Feedback de erro amigável
- Proteção contra tentativas excessivas
- Registro de acesso

Após login válido:

- Criar sessão local segura
- Identificar perfil do usuário
- Redirecionar para o dashboard

---

## 2. Perfis de acesso

Implementar controle de acesso por perfil:

### Administrador

Pode:

- Gerenciar usuários autorizados
- Gerenciar permissões
- Visualizar todos os logs
- Visualizar todos os dashboards
- Configurar limites de envio
- Configurar domínios sensíveis
- Visualizar todas as campanhas
- Exportar relatórios

### Operador

Pode:

- Criar campanhas
- Importar destinatários
- Enviar teste
- Agendar campanha
- Pausar campanhas próprias
- Visualizar campanhas próprias
- Visualizar logs das próprias campanhas

### Auditor/Consulta

Pode:

- Visualizar campanhas
- Visualizar logs
- Visualizar dashboards
- Exportar relatórios, se autorizado
- Não pode criar, alterar ou enviar campanhas

---

## 3. Área de campanhas de e-mail

Criar área para criação e gerenciamento de campanhas.

Funcionalidades obrigatórias:

- Criar campanha
- Editar campanha em rascunho
- Definir assunto
- Criar corpo HTML
- Criar corpo em texto puro
- Visualizar prévia do e-mail
- Enviar e-mail de teste
- Importar destinatários via CSV
- Importar destinatários via XLSX
- Validar e-mails inválidos
- Remover duplicados
- Segmentar destinatários
- Agendar envio
- Iniciar envio
- Pausar envio
- Cancelar envio
- Reenviar falhas
- Consultar status por destinatário

O remetente deverá ser sempre o usuário autenticado.

Não permitir edição manual do remetente.

---

## 4. Importação de destinatários

A importação deve aceitar arquivos CSV e XLSX.

Campos mínimos:

```txt
email,nome
```

Campos opcionais:

```txt
cpf,setor,cargo,orgao,cidade,estado,tags
```

Regras:

- Validar formato do e-mail
- Remover duplicados
- Identificar domínios de destino
- Gerar relatório de importação
- Informar quantidade válida
- Informar quantidade inválida
- Informar duplicados removidos
- Permitir download da lista de erros

---

## 5. Fila de envio

Implementar fila profissional de envio usando Redis e BullMQ.

Cada destinatário deve gerar um job individual ou controlado em lote.

Status obrigatórios:

- Rascunho
- Agendado
- Em fila
- Enviando
- Enviado
- Falhou
- Pausado
- Cancelado
- Concluído

Para cada destinatário:

- Pendente
- Enviado
- Falhou
- Reenviado
- Cancelado

---

## 6. Rate limit e delay

Implementar controle de envio para evitar bloqueios e filtros de provedores externos.

Regras obrigatórias:

- Rate limit global
- Rate limit por domínio
- Delay entre mensagens
- Tentativas automáticas configuráveis
- Backoff progressivo em caso de erro
- Pausa automática em alta taxa de falha

Criar atenção especial para domínios sensíveis:

- outlook.com
- hotmail.com
- live.com
- msn.com

Permitir configuração administrativa de limites por domínio.

Exemplo:

```txt
hotmail.com: 10 mensagens por minuto
outlook.com: 10 mensagens por minuto
live.com: 10 mensagens por minuto
msn.com: 10 mensagens por minuto
outros domínios: 30 mensagens por minuto
```

---

## 7. Integração com Zimbra

Criar serviço isolado para autenticação e envio via Zimbra.

O serviço deve:

- Validar credenciais do usuário no Zimbra
- Enviar e-mails via SMTP autenticado
- Usar o usuário autenticado como remetente
- Tratar erros SMTP
- Registrar códigos de erro
- Registrar mensagens recusadas
- Permitir diagnóstico de conexão

Nunca misturar lógica de envio com lógica de interface.

Criar camada específica:

```txt
/services/zimbra
/services/email
/services/queue
/services/audit
```

---

## 8. Área administrativa

Criar painel administrativo com:

- Usuários autorizados
- Perfis de acesso
- Ativação e desativação de usuários
- Configuração de rate limit
- Configuração de domínios sensíveis
- Histórico de campanhas
- Logs de acesso
- Logs de envio
- Logs de erro
- Exportação de relatórios
- Status da fila
- Configurações do sistema

---

## 9. Logs e auditoria

Registrar obrigatoriamente:

- Usuário autenticado
- E-mail do usuário
- IP de origem
- User-agent
- Data e hora
- Ação executada
- Campanha criada
- Campanha editada
- Campanha enviada
- Campanha pausada
- Campanha cancelada
- Destinatários importados
- Quantidade de destinatários válidos
- Quantidade de destinatários inválidos
- Alterações administrativas
- Erros de envio
- Tentativas de login inválidas
- Exportações realizadas

Os logs devem ser imutáveis pela interface.

Nenhum usuário deve conseguir apagar logs pela aplicação.

---

## 10. Dashboards

Criar dashboards profissionais e responsivos com:

- Total de campanhas
- Total de e-mails enviados
- Total de falhas
- Taxa de sucesso
- Taxa de falha
- Envios por dia
- Envios por usuário
- Falhas por domínio
- Campanhas recentes
- Usuários mais ativos
- Volume por remetente
- Status da fila
- Tempo médio de envio
- Domínios com maior taxa de erro
- Campanhas em andamento
- Campanhas agendadas

Usar gráficos com Recharts.

---

## 11. Segurança

Implementar obrigatoriamente:

- Validação com Zod
- Sanitização de HTML
- Proteção contra XSS
- Proteção contra CSRF
- Rate limit no login
- Rate limit em APIs críticas
- Controle de sessão
- Permissões por perfil
- Headers de segurança
- Logs de auditoria
- Variáveis sensíveis no `.env`
- Tratamento seguro de erros
- Não expor stack trace em produção

---

## 12. Banco de dados

Modelar banco usando Prisma ORM.

Tabelas obrigatórias:

- users
- roles
- user_roles
- campaigns
- campaign_recipients
- email_jobs
- email_logs
- access_logs
- audit_logs
- settings
- domain_rate_limits
- import_batches
- import_errors

Campos importantes para `users`:

- id
- name
- email
- role
- active
- last_login_at
- created_at
- updated_at

Não armazenar senha do Zimbra.

Campos importantes para `campaigns`:

- id
- name
- subject
- html_body
- text_body
- sender_email
- owner_user_id
- status
- scheduled_at
- started_at
- finished_at
- created_at
- updated_at

Campos importantes para `email_logs`:

- id
- campaign_id
- recipient_email
- sender_email
- status
- smtp_response
- error_message
- attempts
- sent_at
- created_at

---

# Estrutura de pastas esperada

Criar estrutura semelhante a:

```txt
/src
  /app
    /login
    /dashboard
    /campaigns
    /admin
    /logs
    /settings
    /api
  /components
    /ui
    /layout
    /forms
    /tables
    /charts
  /features
    /auth
    /campaigns
    /dashboard
    /admin
    /logs
    /settings
  /services
    /zimbra
    /email
    /queue
    /audit
    /reports
  /lib
    /prisma
    /redis
    /auth
    /security
  /utils
  /types
  /config
/prisma
  schema.prisma
/public
/docker
```

---

# Interface obrigatória

A interface deve ser moderna, profissional e institucional.

Criar:

- Tela de login
- Layout administrativo
- Sidebar
- Header
- Breadcrumbs
- Cards de métricas
- Tabelas com filtros
- Busca
- Paginação
- Modais
- Toasts
- Estados de loading
- Estados de erro
- Confirmações antes de ações críticas
- Tela de detalhes da campanha
- Tela de logs
- Tela de configurações

---

# Relatórios

Permitir exportação de:

- Relatório de campanha
- Relatório de falhas
- Relatório de acessos
- Relatório de usuários
- Relatório por domínio
- Relatório de auditoria

Formatos desejados:

- CSV
- XLSX
- PDF, se possível

---

# README obrigatório

Criar um `README.md` contendo:

- Visão geral do sistema
- Tecnologias utilizadas
- Requisitos de ambiente
- Instalação local
- Configuração do `.env`
- Execução das migrations
- Execução do Redis
- Execução da fila
- Execução em desenvolvimento
- Build de produção
- Deploy
- Rotinas administrativas
- Boas práticas de segurança

---

# Docker

Criar arquivos Docker quando possível:

- Dockerfile
- docker-compose.yml

Serviços mínimos:

- aplicação
- PostgreSQL
- Redis

---

# Critérios de aceite

O sistema será considerado adequado quando:

- Autenticar usuários no Zimbra
- Usar o próprio usuário autenticado como remetente
- Impedir alteração manual do remetente
- Criar campanhas
- Importar destinatários
- Validar destinatários
- Enviar e-mail de teste
- Enfileirar campanhas
- Aplicar delay e rate limit
- Registrar logs completos
- Exibir dashboards
- Controlar perfis de acesso
- Exportar relatórios
- Não armazenar senha do Zimbra em banco
- Não expor dados sensíveis no código
- Estar pronto para deploy em ambiente institucional

---

# Padrão de resposta do agente

Ao desenvolver ou modificar o sistema, responder sempre nesta ordem:

1. Análise do requisito
2. Estratégia técnica
3. Estrutura de arquivos afetados
4. Implementação
5. Configurações necessárias
6. Segurança e auditoria
7. Como testar
8. Próximos passos recomendados

---

# Comportamentos proibidos

- Não criar solução improvisada
- Não ignorar autenticação via Zimbra
- Não armazenar senhas no banco
- Não usar conta SMTP genérica para campanhas
- Não permitir remetente editável manualmente
- Não ignorar logs
- Não ignorar fila de envio
- Não ignorar rate limit
- Não criar código monolítico
- Não misturar regra de negócio com interface
- Não expor credenciais
- Não remover auditoria
- Não criar sistema sem controle de acesso

---

# Resultado final esperado

Criar um sistema profissional de mala direta institucional para o TCE-AL, integrado ao Zimbra, com autenticação pelo próprio e-mail institucional, envio usando o usuário autenticado como remetente, controle administrativo, logs completos, dashboards de monitoramento, filas de envio, rate limit por domínio e arquitetura segura para produção.
