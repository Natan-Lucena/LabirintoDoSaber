# Planejamento — Agendamento de Atendimentos com QStash

## Visão Geral

Padrão **self-chaining queue**: o job processa todos os atendimentos agendados para os
próximos 15 minutos, notifica, então agenda a próxima rodada para o momento do
atendimento mais próximo ainda pendente.

O estado da fila (messageId QStash, próximo run) vive no campo `metadata` do próprio
`Appointment` — sem entidade extra acoplada.

```
[Appointment criado]
        │
        ▼
   Há agendamento mais próximo que o atual nextRunAt?
   Sim → cancelar msg QStash (via metadata do appointment mais antigo) + reagendar
        │
        ▼
══════════ QStash chama /api/queue/appointments/run ════════════

1. Buscar: scheduledAt ≤ now+15min, status PENDING, sem notifiedAt
2. Para cada → notificar → markAsNotified (salva via repo.save)
3. Buscar: próximo PENDING após agora (scheduledAt crescente, limit 1)
4. Se existe → qstash.scheduleNext(nextAppt.scheduledAt)
             → repo.save(nextAppt.withMetadata('qstashMessageId', id))
   Se não    → cadeia encerra
```

---

## Modelo Prisma

```prisma
model Appointment {
  id          String            @id @map("_id")
  educatorId  String
  studentId   String
  scheduledAt DateTime
  observation String?
  status      AppointmentStatus @default(PENDING)
  notifiedAt  DateTime?
  metadata    Json              @default("{}")
  createdAt   DateTime          @default(now())
}

enum AppointmentStatus {
  PENDING
  COMPLETED
  CANCELLED
}
```

> `metadata` armazena dados da fila (ex.: `qstashMessageId`) sem poluir o modelo com campos
> de infraestrutura. Na entidade é tipado como `Record<string, string | Date | null>`.

---

## Entidade

```ts
// src/domain/entities/appointment.ts

import { Uuid } from '@wave-telecom/framework/core'

export type AppointmentMetadata = Record<string, string | Date | null>

export enum AppointmentStatus {
  PENDING   = 'PENDING',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface CreateAppointmentProps {
  id?:          Uuid
  educatorId:   Uuid
  studentId:    Uuid
  scheduledAt:  Date
  observation?: string
  status?:      AppointmentStatus
  notifiedAt?:  Date
  metadata?:    AppointmentMetadata
  createdAt?:   Date
}

export interface UpdateAppointmentProps {
  scheduledAt?:  Date
  observation?:  string | null
}

export class Appointment {
  private constructor(
    public readonly id:          Uuid,
    public readonly educatorId:  Uuid,
    public readonly studentId:   Uuid,
    private _scheduledAt:        Date,
    private _observation:        string | undefined,
    private _status:             AppointmentStatus,
    private _notifiedAt:         Date | undefined,
    private _metadata:           AppointmentMetadata,
    public readonly createdAt:   Date,
  ) {}

  static create(props: CreateAppointmentProps): Appointment {
    return new Appointment(
      props.id          ?? Uuid.random(),
      props.educatorId,
      props.studentId,
      props.scheduledAt,
      props.observation,
      props.status      ?? AppointmentStatus.PENDING,
      props.notifiedAt,
      props.metadata    ?? {},
      props.createdAt   ?? new Date(),
    )
  }

  update(props: UpdateAppointmentProps): Appointment {
    return new Appointment(
      this.id, this.educatorId, this.studentId,
      props.scheduledAt                          ?? this._scheduledAt,
      props.observation !== undefined ? (props.observation ?? undefined) : this._observation,
      this._status,
      this._notifiedAt,
      this._metadata,
      this.createdAt,
    )
  }

  cancel(): Appointment {
    return new Appointment(
      this.id, this.educatorId, this.studentId,
      this._scheduledAt, this._observation,
      AppointmentStatus.CANCELLED,
      this._notifiedAt, this._metadata, this.createdAt,
    )
  }

  markAsNotified(at: Date): Appointment {
    return new Appointment(
      this.id, this.educatorId, this.studentId,
      this._scheduledAt, this._observation,
      this._status, at, this._metadata, this.createdAt,
    )
  }

  withMetadata(key: string, value: string | Date | null): Appointment {
    return new Appointment(
      this.id, this.educatorId, this.studentId,
      this._scheduledAt, this._observation,
      this._status, this._notifiedAt,
      { ...this._metadata, [key]: value },
      this.createdAt,
    )
  }

  get scheduledAt():  Date                    { return this._scheduledAt  }
  get observation():  string | undefined       { return this._observation  }
  get status():       AppointmentStatus        { return this._status       }
  get notifiedAt():   Date | undefined         { return this._notifiedAt   }
  get metadata():     AppointmentMetadata      { return this._metadata     }
}
```

---

## Serviço de Agendamento

A interface vive na camada de **aplicação** e fala apenas em termos de `Appointment`.
A implementação fica na **infraestrutura** e é a única que conhece QStash, as chaves do
`metadata` e a lógica de cadeia — incluindo se precisa ou não reagendar.

O educador pode ter N atendimentos marcados (mesmo dia, mesma hora, pacientes distintos).
A cadeia não é "um slot por educador" — é um job global que varre todos os pendentes da
janela de 15 min. Por isso o use-case **não decide** se reagenda: ele apenas avisa o serviço
que um novo appointment existe e o serviço resolve internamente.

```ts
// src/application/services/appointment-scheduler-service.ts

import { Appointment } from '../../domain/entities/appointment'

export interface AppointmentSchedulerService {
  // Garante que haverá um disparo do job a tempo de cobrir este appointment.
  // Internamente decide se a cadeia atual já o cobre ou se precisa reagendar.
  ensureScheduled(appointment: Appointment): Promise<void>

  // Remove este appointment da cadeia e repara o próximo disparo.
  // Internamente lê o metadata para cancelar o job QStash correto.
  cancel(appointment: Appointment): Promise<void>

  // Chamado pelo job após processar a janela atual.
  // Busca o próximo pendente e agenda o próximo disparo.
  scheduleNext(): Promise<void>
}
```

A implementação injeta o repositório para tomar decisões de cadeia sem expor nada disso
ao use-case:

```ts
// src/infraestructure/services/qstash-appointment-scheduler-impl.ts

import { Client } from '@upstash/qstash'
import { AppointmentSchedulerService } from '../../application/services/appointment-scheduler-service'
import { AppointmentRepository } from '../../domain/repositories/appointment-repository'
import { Appointment, AppointmentStatus } from '../../domain/entities/appointment'

const CHAIN_KEY = 'qstashMessageId'

export class QStashAppointmentSchedulerImpl implements AppointmentSchedulerService {
  constructor(
    private readonly client: Client,
    private readonly appointmentRepo: AppointmentRepository,
  ) {}

  async ensureScheduled(appointment: Appointment): Promise<void> {
    // Encontrar o appointment que atualmente lidera a cadeia (tem messageId no metadata)
    const [chainLeader] = await this.appointmentRepo.search({
      status: AppointmentStatus.PENDING,
      scheduledAfter: new Date(),
      hasScheduledJob: true,  // metadata[CHAIN_KEY] existe
      limit: 1,
    })

    // Se já há um job que vai disparar antes deste appointment, não precisa fazer nada
    if (chainLeader && chainLeader.scheduledAt <= appointment.scheduledAt) return

    // Reagendar: cancelar o líder atual (se existir) e assumir com o mais próximo
    if (chainLeader) {
      await this.client.messages.delete(chainLeader.metadata[CHAIN_KEY] as string)
      await this.appointmentRepo.save(
        chainLeader.withMetadata(CHAIN_KEY, null),
      )
    }

    await this._publishAndSave(appointment)
  }

  async cancel(appointment: Appointment): Promise<void> {
    const messageId = appointment.metadata[CHAIN_KEY]
    if (typeof messageId === 'string') {
      await this.client.messages.delete(messageId)
      await this.appointmentRepo.save(appointment.withMetadata(CHAIN_KEY, null))
    }
    // Reparar a cadeia para o próximo válido
    await this.scheduleNext()
  }

  async scheduleNext(): Promise<void> {
    const [next] = await this.appointmentRepo.search({
      status: AppointmentStatus.PENDING,
      scheduledAfter: new Date(),
      notified: false,
      hasScheduledJob: false, // ainda não tem messageId
      limit: 1,
    })
    if (next) await this._publishAndSave(next)
  }

  private async _publishAndSave(appointment: Appointment): Promise<void> {
    const delaySeconds = Math.max(
      0,
      Math.floor((appointment.scheduledAt.getTime() - Date.now()) / 1000),
    )
    const res = await this.client.publishJSON({
      url: `${process.env.API_URL}/api/queue/appointments/run`,
      body: {},
      delay: delaySeconds,
    })
    await this.appointmentRepo.save(appointment.withMetadata(CHAIN_KEY, res.messageId))
  }
}
```

> Todo o conhecimento de QStash e de cadeia — chaves de metadata, comparação de líderes,
> repair após cancelamento — fica isolado em `QStashAppointmentSchedulerImpl`.
> Trocar por outro provider exige mudar apenas este arquivo.

---

## Repositório

```ts
// src/domain/repositories/appointment-repository.ts

import { Uuid } from '@wave-telecom/framework/core'
import { Appointment, AppointmentStatus } from '../entities/appointment'

export interface SearchAppointmentParams {
  educatorId?:       Uuid
  studentId?:        Uuid
  status?:           AppointmentStatus
  scheduledBefore?:  Date    // agendados até now+15min (janela do job)
  scheduledAfter?:   Date    // próximos após agora
  notified?:         boolean
  hasScheduledJob?:  boolean // filtra se metadata tem/não tem o messageId do job
  limit?:            number
}

export interface AppointmentRepository {
  save(appointment: Appointment): Promise<void>
  getById(id: Uuid): Promise<Appointment | null>
  search(params: SearchAppointmentParams): Promise<Appointment[]>
  delete(id: Uuid): Promise<void>
}
```

---

## Estrutura do Módulo

```
src/application/modules/appointment/
├── routes/
│   └── appointment-routes.ts
├── schemas/
│   └── appointment-schemas.ts
└── use-cases/
    ├── create-appointment/
    │   ├── create-appointment-use-case.ts
    │   └── create-appointment-use-case.spec.ts
    ├── update-appointment/
    │   ├── update-appointment-use-case.ts
    │   └── update-appointment-use-case.spec.ts
    ├── delete-appointment/
    │   ├── delete-appointment-use-case.ts
    │   └── delete-appointment-use-case.spec.ts
    ├── list-appointments/
    │   └── list-appointments-use-case.ts
    ├── get-appointment/
    │   └── get-appointment-use-case.ts
    └── notify-appointments/          ← job chamado pelo QStash
        ├── notify-appointments-use-case.ts
        └── notify-appointments-use-case.spec.ts
```

---

## Use-Cases Principais

### `create-appointment`

```ts
async execute({ educatorId, studentId, scheduledAt, observation }) {
  const appointment = Appointment.create({ educatorId, studentId, scheduledAt, observation })
  await this.appointmentRepo.save(appointment)
  await this.schedulerService.ensureScheduled(appointment)
}
```

> O use-case não sabe se há outros agendamentos, se a cadeia precisa reagendar ou não.
> Isso é responsabilidade do `schedulerService.ensureScheduled` — que internamente compara
> com o líder atual da cadeia e decide.

### `notify-appointments` (job)

```ts
async execute() {
  const windowEnd = new Date(Date.now() + 15 * 60 * 1000)

  const due = await this.appointmentRepo.search({
    scheduledBefore: windowEnd,
    status: AppointmentStatus.PENDING,
    notified: false,
  })

  for (const appt of due) {
    await this.mailService.sendAppointmentReminder(appt)
    await this.appointmentRepo.save(appt.markAsNotified(new Date()))
  }

  await this.schedulerService.scheduleNext()
}
```

### `delete-appointment`

```ts
async execute({ id, educatorId }) {
  const appt = await this.appointmentRepo.getById(id)
  if (!appt || !appt.educatorId.equals(educatorId)) throw new Error('NOT_FOUND')

  await this.schedulerService.cancel(appt)  // cancela job + repara cadeia internamente
  await this.appointmentRepo.delete(id)
}
```

---

## Infraestrutura

### Endpoint do runner

```ts
// validação da assinatura QStash — rejeita chamadas não autorizadas
router.post('/queue/appointments/run',
  verifyQStashSignature,
  async (req, res) => {
    await notifyAppointmentsUseCase.execute()
    res.sendStatus(200)
  }
)
```

---

## Novos Arquivos

```
src/
├── domain/
│   ├── entities/
│   │   └── appointment.ts
│   └── repositories/
│       └── appointment-repository.ts
│
├── application/
│   ├── services/
│   │   └── appointment-scheduler-service.ts    ← interface: schedule / cancel
│   └── modules/
│       └── appointment/  (estrutura acima)
│
└── infraestructure/
    ├── repositories/prisma/
    │   └── appointment-repository-impl.ts
    └── services/
        └── qstash-appointment-scheduler-impl.ts ← única classe que conhece QStash
```

---

## Agendamentos no futuro distante

Exemplo: hoje é 11/06/2026 e há um atendimento marcado para 11/07/2026.

**O que acontece no fluxo:**
```
11/06 → ensureScheduled → 1 msg QStash publicada com Upstash-Not-Before = unix(11/07)
         cadeia dorme
Dias 2–30: watchdog diário roda, vê chain leader → não faz nada
11/07 → QStash dispara → job roda → notifica → scheduleNext() → sem próximo → cadeia encerra
```

Zero requests intermediárias. A mensagem fica na fila do QStash e dispara no timestamp exato.

**Por que `Upstash-Not-Before` e não `Upstash-Delay`:**

`Upstash-Delay` é relativo ao momento de publicação (em segundos). Para datas distantes,
qualquer drift de processamento acumula erro. `Upstash-Not-Before` usa Unix timestamp absoluto
e dispara na hora exata independente de quando foi publicado.

```
// ERRADO para datas distantes
'Upstash-Delay': '2592000s'  // 30 dias em segundos — impreciso

// CORRETO
'Upstash-Not-Before': String(Math.floor(appointment.scheduledAt.getTime() / 1000))
```

---

## Variáveis de Ambiente

Valores já mapeados no `.env`. Na implementação, acessar via `process.env.*`.

```env
API_URL=                        # URL pública da API na Vercel
QSTASH_URL=                     # https://qstash-us-east-1.upstash.io
QSTASH_TOKEN=                   # token de publicação
QSTASH_CURRENT_SIGNING_KEY=     # validação de assinatura das chamadas recebidas
QSTASH_NEXT_SIGNING_KEY=        # rotação de chave de assinatura
INTERNAL_JOB_API_KEY=           # chave para proteger o endpoint do job
```

> Integração via HTTP direto (`fetch`) — sem SDK `@upstash/qstash`.

```ts
// publicação com Upstash-Not-Before + forwarding da API key
await fetch(
  `${process.env.QSTASH_URL}/v2/publish/${process.env.API_URL}/api/queue/appointments/run`,
  {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.QSTASH_TOKEN}`,
      'Content-Type': 'application/json',
      'Upstash-Not-Before': String(Math.floor(appointment.scheduledAt.getTime() / 1000)),
      'Upstash-Forward-X-Job-Api-Key': process.env.INTERNAL_JOB_API_KEY!,
      'Upstash-Retries': '5',
    },
    body: JSON.stringify({}),
  }
)

// cancelamento
await fetch(`${process.env.QSTASH_URL}/v2/messages/${messageId}`, {
  method: 'DELETE',
  headers: { Authorization: `Bearer ${process.env.QSTASH_TOKEN}` },
})
```

### Proteção do endpoint do job com API Key

O QStash encaminha o header `Upstash-Forward-X-Job-Api-Key` como `X-Job-Api-Key` no request
ao endpoint. O middleware verifica esse header antes de executar o job:

```ts
// middleware
export function requireJobApiKey(req: Request, res: Response, next: NextFunction) {
  const key = req.headers['x-job-api-key']
  if (key !== process.env.INTERNAL_JOB_API_KEY) {
    return res.sendStatus(401)
  }
  next()
}
```

Isso garante que apenas o QStash (que conhece a chave) consegue acionar o endpoint.
Requests diretos sem a chave são rejeitados com 401.

---

## Resiliência

### O que acontece se uma notificação fica fora da janela?

Exemplo: são 20:22 e o appointment das 20:19 não foi notificado.

**Não há perda.** O job usa `scheduledBefore: now + 15min`. Qualquer data no passado
é menor que `now + 15min`, então appointments atrasados são sempre capturados na próxima
rodada. O job que roda às 20:22 tem janela até 20:37 — e 20:19 < 20:37, então é processado.

O design é retrospectivo por natureza: `notified: false` + `scheduledBefore: now+15min`
cobre tanto o presente quanto todo o passado não notificado.

---

### O que pode parar o fluxo? Como garantir que nunca pare?

#### Causas de parada acidental

| Causa | O que acontece |
|---|---|
| QStash esgota retries (5x no free tier) | Job não é chamado; cadeia morre |
| `scheduleNext()` lança exceção | Próximo run não é agendado |
| Endpoint retorna 5xx repetidamente | QStash para de tentar; cadeia morre |
| Timeout do Vercel (60s no Hobby) | Job não conclui; sem `scheduleNext` |
| Bug ao salvar `notifiedAt` | Appointment fica em loop de renotificação |

#### Parada intencional (OK)

A cadeia para naturalmente quando não há mais appointments pendentes. Isso é correto —
ela reinicia automaticamente no próximo `create-appointment` via `ensureScheduled`.

#### Estratégia de resiliência em camadas

**Camada 1 — Reinício automático via `create-appointment`**
Qualquer novo agendamento chama `ensureScheduled`, que detecta cadeia morta
(nenhum appointment com `qstashMessageId`) e a reinicia. Zero intervenção manual.

**Camada 2 — Watchdog diário (Vercel Cron)**
Um cron que roda uma vez ao dia verifica se a cadeia está viva:

```ts
// GET /api/queue/appointments/watchdog  (cron: "0 6 * * *")
const hasPending = await appointmentRepo.search({
  status: AppointmentStatus.PENDING,
  scheduledAfter: new Date(),
  notified: false,
})
const hasChainLeader = await appointmentRepo.search({
  status: AppointmentStatus.PENDING,
  hasScheduledJob: true,
})

if (hasPending.length > 0 && hasChainLeader.length === 0) {
  // cadeia morreu com appointments pendentes — reiniciar
  await schedulerService.scheduleNext()
}
```

Usa 1 das 2 cotas de cron do Hobby. Garante recuperação em no máximo 24h mesmo sem novos agendamentos.

**Camada 3 — Endpoint retorna 200 mesmo em falha de e-mail**
O job deve retornar `200` ao QStash mesmo se o envio de um e-mail falhar individualmente.
Falha de e-mail não deve ser motivo para QStash retentar o job inteiro (causaria renotificações).
Erros de e-mail devem ser logados separadamente.

```ts
for (const appt of due) {
  try {
    await this.mailService.sendAppointmentReminder(appt)
    await this.appointmentRepo.save(appt.markAsNotified(new Date()))
  } catch {
    // log, não relança — cadeia não para por falha de e-mail
  }
}
```

**Camada 4 — Bootstrap manual**
Endpoint protegido para reativar a cadeia em qualquer momento:
```
POST /api/queue/appointments/bootstrap
Authorization: Bearer <INTERNAL_SECRET>
```

#### Resumo das garantias

```
Nova notificação criada  →  ensureScheduled  →  cadeia sempre viva
Cadeia morre             →  watchdog (6h)   →  máx. 24h sem notificação
Watchdog falha           →  bootstrap manual →  operação sem downtime
```
