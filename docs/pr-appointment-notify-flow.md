# PR — Módulo de agendamento e notificação de atendimentos

## Resumo

- Novo módulo `appointment` com CRUD completo (create, update, delete, list, get) e endpoint de job (`/notify`) chamado pelo QStash para entrega de lembretes por e-mail.
- Notificações orquestradas por **self-chaining queue**: cada execução do job agenda a próxima rodada para o `scheduledAt` exato do próximo appointment pendente — sem cron periódico, sem polling, zero requests ociosas durante gaps longos (ex.: appointment 30 dias à frente).
- Estado da cadeia armazenado em campo `metadata: Json` no próprio `Appointment` (chave `qstashMessageId`), evitando entidade de estado global acoplada ao provider. A camada de aplicação é completamente agnóstica ao QStash — só conhece `AppointmentSchedulerService`.
- Endpoint `/notify` e `/watchdog` protegidos por `X-Job-Api-Key` (header forwarded pelo QStash via `Upstash-Forward-*`); sem SDK `@upstash/qstash` — integração via `fetch` direto à API REST.
- Watchdog diário detecta cadeia morta com appointments pendentes e reinicia; falhas de e-mail por appointment são capturadas individualmente e não interrompem `scheduleNext()`.

## Secrets necessários na Vercel

Todas as variáveis abaixo devem ser adicionadas em **Settings → Environment Variables** do projeto na Vercel antes do deploy.

| Secret | Valor | Onde obter |
|--------|-------|-----------|
| `API_URL` | URL pública do deploy (ex.: `https://seu-app.vercel.app`) | Dashboard da Vercel |
| `QSTASH_URL` | `https://qstash-us-east-1.upstash.io` | Console Upstash → QStash |
| `QSTASH_TOKEN` | Token de publicação | Console Upstash → QStash → Token |
| `QSTASH_CURRENT_SIGNING_KEY` | Chave de assinatura atual | Console Upstash → QStash → Keys |
| `QSTASH_NEXT_SIGNING_KEY` | Chave de assinatura de rotação | Console Upstash → QStash → Keys |
| `INTERNAL_JOB_API_KEY` | String aleatória segura (gerar com `openssl rand -hex 32`) | Gerado localmente |

## Plano de testes

- [ ] `pnpm test` passa todas as suites do módulo `appointment` (entidade + 4 use-cases)
- [ ] `POST /appointment` cria agendamento e retorna 201 com os dados
- [ ] `PUT /appointment/:id` atualiza `scheduledAt` e `observation`; retorna 404 para id inexistente ou educador diferente
- [ ] `DELETE /appointment/:id` remove agendamento; retorna 404 para id inexistente ou educador diferente
- [ ] `GET /appointment` lista apenas agendamentos do educador autenticado
- [ ] `POST /appointment/notify` sem `X-Job-Api-Key` retorna 401
- [ ] `POST /appointment/notify` com chave correta processa appointments pendentes e agenda próxima rodada
- [ ] Criar dois appointments — confirmar que o QStash tem apenas 1 mensagem ativa (o mais próximo)
- [ ] Deletar o appointment que é o chain leader — confirmar que a cadeia é reparada para o próximo
