# Agendamento de Atendimentos — Proposta de Implementação

## Entidade `Appointment`

O schema já possui `TaskNotebookSession` (sessão em andamento) e `StudentAnalysisReport` (relatório pós-sessão).
A nova entidade representa o **agendamento prévio** — distinto da sessão em si.

```prisma
model Appointment {
  id          String            @id @map("_id")
  educatorId  String
  studentId   String
  scheduledAt DateTime          // data/hora do atendimento
  observation String?           // anotação livre do educador
  status      AppointmentStatus @default(PENDING)
  notifiedAt  DateTime?         // preenchido ao enviar o lembrete (idempotency guard)
  createdAt   DateTime          @default(now())
}

enum AppointmentStatus {
  PENDING
  COMPLETED
  CANCELLED
}
```

> **`notifiedAt`** é importante independente da opção de agendamento escolhida.
> Serve como guard de idempotência para não enviar o mesmo lembrete duas vezes.

---

## Opções de Orquestração

### Opção 1 — Vercel Cron + Polling no banco

**Como funciona:** um endpoint é chamado uma vez por dia pelo scheduler da Vercel.
Ele busca no MongoDB todos os `Appointment` com `scheduledAt` dentro do próximo intervalo (ex.: nas próximas 24h) e envia o e-mail via o `mail-service` já existente.

```json
// vercel.json
{
  "crons": [{ "path": "/api/cron/notify-appointments", "schedule": "0 8 * * *" }]
}
```

```ts
// lógica do endpoint
const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
const appointments = await repo.findPendingBefore(tomorrow)

for (const appt of appointments) {
  if (appt.notifiedAt) continue // já notificado
  await mailService.sendAppointmentReminder(appt)
  await repo.markAsNotified(appt.id)
}
```

| | |
|---|---|
| **Custo** | Zero — incluso no free tier da Vercel Hobby |
| **Precisão** | Diária apenas (mínimo do Hobby) |
| **Complexidade** | Baixa |
| **Dependência extra** | Nenhuma |

**Limitação crítica:** o plano Hobby não permite frequência menor que diária.
Não é possível fazer "lembrar 1h antes". O lembrete seria sempre "na manhã do dia do atendimento".

---

### Opção 2 — QStash (Upstash)

**Como funciona:** ao criar o `Appointment`, o use-case publica uma mensagem agendada no QStash
com o delay exato até o momento da notificação. O QStash chama seu endpoint na hora certa,
mesmo sendo serverless.

```ts
// dentro do create-appointment use-case
const notifyAt = scheduledAt.getTime() - 60 * 60 * 1000 // 1h antes
const delaySeconds = Math.floor((notifyAt - Date.now()) / 1000)

await qstash.publishJSON({
  url: `${process.env.API_URL}/api/internal/notify-appointment`,
  body: { appointmentId: appointment.id },
  delay: delaySeconds,
})
```

```ts
// endpoint receptor /api/internal/notify-appointment
const { appointmentId } = req.body
const appt = await repo.findById(appointmentId)

if (!appt || appt.notifiedAt) return res.sendStatus(200) // idempotente

await mailService.sendAppointmentReminder(appt)
await repo.markAsNotified(appt.id)
```

| | |
|---|---|
| **Custo** | Zero — free tier: 500 mensagens/dia, 5 retries automáticos |
| **Precisão** | Exata — "X minutos/horas antes" |
| **Complexidade** | Média |
| **Dependência extra** | Conta Upstash (gratuita) |

**Ponto de atenção:** se o educador cancelar ou reagendar o atendimento, é preciso cancelar a
mensagem agendada no QStash via `messageId` retornado no `publishJSON`. Guardar esse ID no
`Appointment` resolve.

---

### Opção 3 — Trigger.dev

**Como funciona:** SDK de background jobs integrado ao deploy. Define-se um job com delay declarativo;
o Trigger.dev gerencia a fila, retries e logs.

```ts
// definição do job
client.defineJob({
  id: 'notify-appointment',
  name: 'Lembrete de Atendimento',
  version: '1.0.0',
  trigger: eventTrigger({ name: 'appointment.created' }),
  run: async (payload, io) => {
    const delaySeconds = payload.secondsUntilNotification
    await io.wait('aguardar-sessao', delaySeconds)
    await io.runTask('enviar-email', async () => {
      await sendAppointmentReminder(payload.appointmentId)
    })
  },
})
```

| | |
|---|---|
| **Custo** | Zero — free tier: 25.000 runs/mês |
| **Precisão** | Exata |
| **Complexidade** | Alta |
| **Dependência extra** | Conta Trigger.dev + SDK instalado |

---

## Comparativo

| Critério              | Vercel Cron | QStash (Upstash) | Trigger.dev |
|-----------------------|:-----------:|:----------------:|:-----------:|
| Custo                 | Zero        | Zero             | Zero        |
| Timing preciso        | Não         | Sim              | Sim         |
| Cancelamento fácil    | Sim         | Sim (messageId)  | Sim         |
| Dependência extra     | Nenhuma     | Upstash          | Trigger.dev |
| Setup                 | Simples     | Médio            | Complexo    |
| Compatível c/ Hobby   | Sim         | Sim              | Sim         |

---

## Recomendação

**Lembrete genérico "no dia do atendimento" → Opção 1 (Vercel Cron)**
Zero dependência extra, aproveita o `mail-service` existente, encaixa no free tier sem configuração adicional.

**Lembrete "X horas antes" com precisão → Opção 2 (QStash)**
Free tier da Upstash é generoso para o volume de um projeto educacional pequeno.
A integração é uma chamada HTTP no use-case de criação — baixo acoplamento.
Guardar o `qstashMessageId` no `Appointment` permite cancelar/reagendar sem complexidade.

A entidade `Appointment` serve para as duas opções.
O `notifiedAt` é o pivô: no Cron, o polling filtra onde é `null`; no QStash, é setado após o delivery.
