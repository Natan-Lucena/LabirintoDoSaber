# Arquitetura — Módulo de Agendamento de Atendimentos

## Visão Geral

O módulo permite que educadores agendem sessões de atendimento com seus alunos.
Quando a hora do atendimento se aproxima, o educador recebe uma notificação por e-mail.

A entrega das notificações é orquestrada por um **self-chaining queue** sobre o QStash
(Upstash): em vez de um cron periódico, cada execução do job agenda a próxima rodada
para o exato momento do próximo atendimento pendente. Isso elimina polling desnecessário
e funciona dentro das restrições do plano gratuito da Vercel (sem execuções longas).

---

## Camadas e Responsabilidades

```
┌────────────────────────────────────────────────────────────────┐
│  HTTP (Express)                                                │
│  POST /appointment          → CreateAppointmentController     │
│  PUT  /appointment/:id      → UpdateAppointmentController     │
│  DELETE /appointment/:id    → DeleteAppointmentController     │
│  GET  /appointment          → ListAppointmentsController      │
│  GET  /appointment/:id      → GetAppointmentController        │
│  POST /appointment/notify   → NotifyAppointmentsController    │  ← QStash
│  POST /appointment/watchdog → WatchdogAppointmentsController  │  ← QStash
└────────────────────────────────────────────────────────────────┘
           │
┌────────────────────────────────────────────────────────────────┐
│  Application — Use-Cases                                       │
│  CreateAppointmentUseCase    UpdateAppointmentUseCase          │
│  DeleteAppointmentUseCase    ListAppointmentsUseCase           │
│  GetAppointmentUseCase       NotifyAppointmentsUseCase         │
│  WatchdogAppointmentsUseCase                                   │
│                                                                │
│  Interfaces consumidas:                                        │
│    AppointmentRepository     AppointmentSchedulerService       │
│    MailService                                                 │
└────────────────────────────────────────────────────────────────┘
           │
┌────────────────────────────────────────────────────────────────┐
│  Domain                                                        │
│  Appointment (entity)          AppointmentStatus (enum)        │
│  AppointmentRepository         AppointmentSchedulerService     │
│  MailService                                                   │
└────────────────────────────────────────────────────────────────┘
           │
┌────────────────────────────────────────────────────────────────┐
│  Infrastructure                                                │
│  AppointmentRepositoryImpl     → Prisma / MongoDB              │
│  QStashAppointmentSchedulerImpl → QStash REST API             │
│  NodemailerMailService          → SMTP                        │
└────────────────────────────────────────────────────────────────┘
```

---

## Entidade `Appointment`

Imutável — todos os métodos de mutação retornam nova instância.

| Campo        | Tipo                  | Descrição                                        |
|--------------|-----------------------|--------------------------------------------------|
| `id`         | `Uuid`                | Identificador único                              |
| `educatorId` | `Uuid`                | Educador dono do agendamento                     |
| `studentId`  | `Uuid`                | Aluno da sessão                                  |
| `scheduledAt`| `Date`                | Data e hora do atendimento                       |
| `observation`| `string?`             | Anotação livre do educador                       |
| `status`     | `AppointmentStatus`   | `PENDING` \| `COMPLETED` \| `CANCELLED`          |
| `notifiedAt` | `Date?`               | Preenchido quando o lembrete é enviado           |
| `metadata`   | `Record<string, string\|Date\|null>` | Bag opaco para dados de infraestrutura |
| `createdAt`  | `Date`                | Data de criação                                  |

O campo `metadata` armazena o `qstashMessageId` do job agendado. É opaco para a camada
de aplicação — apenas `QStashAppointmentSchedulerImpl` conhece sua estrutura interna.

---

## Self-Chaining Queue

### Princípio

Há sempre no máximo **1 mensagem ativa** no QStash apontando para o endpoint do job.
Essa mensagem é agendada para disparar exatamente no `scheduledAt` do próximo appointment
pendente. Quando o job roda, ele:

1. Processa todos os appointments em `[now, now + 15min]`
2. Notifica cada um (e-mail)
3. Agenda o próximo disparo para o appointment mais próximo ainda pendente

### Fluxo de Criação

```
Educator cria appointment
        │
        ▼
ensureScheduled(appointment)
        │
   Há chain leader (appointment com qstashMessageId)?
        │
   ┌────┴───────────────────────────────────────┐
   │ Não → publicar no QStash → salvar messageId│
   │ Sim e chainLeader.scheduledAt ≤ novo       │
   │      → não fazer nada (chain já cobre)     │
   │ Sim e chainLeader.scheduledAt > novo       │
   │      → cancelar chain leader               │
   │      → publicar para o novo               │
   └────────────────────────────────────────────┘
```

### Fluxo do Job (`/appointment/notify`)

```
QStash dispara
        │
        ▼
search(scheduledBefore: now+15min, PENDING, notified: false)
        │
        ▼
Para cada appointment:
  try → mailService.sendAppointmentReminder()
      → repo.save(appt.markAsNotified(now))
  catch → log, continua (falha de e-mail não para a cadeia)
        │
        ▼
schedulerService.scheduleNext()
  → search(scheduledAfter: now, PENDING, notified: false, limit: 1)
  → Se existe → publica no QStash → salva messageId
  → Se não    → cadeia encerra (reinicia no próximo create)
```

### Agendamentos no Futuro Distante

Para appointments muito além do presente (ex.: 30 dias), a mensagem QStash fica
dormindo na fila com `Upstash-Not-Before: <unix_timestamp>`. Zero requests intermediárias.
O watchdog diário confirma que a cadeia está viva mas não interfere.

**`Upstash-Not-Before` (timestamp absoluto)** é usado em vez de `Upstash-Delay`
(delay relativo em segundos) para precisão em datas distantes.

---

## Proteção do Endpoint do Job

O endpoint `/appointment/notify` e `/appointment/watchdog` não usam autenticação JWT
(não há usuário logado — é o QStash que chama). A proteção é feita por API key:

1. Ao publicar, o scheduler adiciona `Upstash-Forward-X-Job-Api-Key: <INTERNAL_JOB_API_KEY>`
2. O QStash encaminha esse header como `X-Job-Api-Key` no request ao endpoint
3. O middleware `requireJobApiKey` rejeita requests sem o header correto com `401`

---

## Resiliência em Camadas

| Camada | Mecanismo | Cobertura |
|--------|-----------|-----------|
| 1 | `ensureScheduled` no `create-appointment` | Reinicia cadeia automaticamente se morta |
| 2 | Watchdog diário (`/appointment/watchdog`) | Detecta cadeia morta com appointments pendentes |
| 3 | Job retorna 200 em falha de e-mail | QStash não retenta; evita duplicatas |
| 4 | QStash retries (5x, backoff exponencial) | Falhas transientes do endpoint |
| 5 | Endpoint de bootstrap manual | Recuperação operacional de emergência |

### Notificações atrasadas

O job usa `scheduledBefore: now + 15min`, que inclui **qualquer data no passado**.
Se o QStash atrasar a entrega, o job que rodar depois ainda captura os appointments
que ficaram para trás — não há perda por entrega tardia.

---

## Arquivos

```
prisma/schema.prisma                            ← Appointment model + AppointmentStatus

src/domain/
  entities/appointment.ts                       ← entidade imutável
  repositories/appointment-repository.ts        ← interface do repositório
  services/appointment-scheduler-service.ts     ← interface do scheduler
  services/mail-service.ts                      ← +sendAppointmentReminder
  tests/entities/appointment.spec.ts            ← testes da entidade

src/application/
  modules/appointment/
    use-cases/create-appointment/
    use-cases/update-appointment/
    use-cases/delete-appointment/
    use-cases/list-appointments/
    use-cases/get-appointment/
    use-cases/notify-appointments/
    use-cases/watchdog-appointments/
    controllers/                                ← um por use-case
    schemas/appointment-schemas.ts
    routes/index.ts

src/infraestructure/
  repositories/prisma/appointment-repository-impl.ts
  services/qstash-appointment-scheduler-impl.ts ← HTTP direto, sem SDK
  services/mail-service-impl.ts                 ← +sendAppointmentReminder
  middlewares/index.ts                          ← +requireJobApiKey
  factories/index.ts                            ← +makeAppointmentRepository
  mappers/map-appointment.ts
```

---

## Variáveis de Ambiente Necessárias

| Variável | Descrição |
|---|---|
| `API_URL` | URL pública da API na Vercel (ex.: `https://app.vercel.app`) |
| `QSTASH_URL` | Base URL do QStash (`https://qstash-us-east-1.upstash.io`) |
| `QSTASH_TOKEN` | Token de publicação do QStash |
| `QSTASH_CURRENT_SIGNING_KEY` | Chave atual para validar assinaturas recebidas |
| `QSTASH_NEXT_SIGNING_KEY` | Chave de rotação para validar assinaturas recebidas |
| `INTERNAL_JOB_API_KEY` | Chave para proteger os endpoints `/notify` e `/watchdog` |
