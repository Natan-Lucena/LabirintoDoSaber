# LabirintoDoSaber — Claude Code Instructions

API REST (Express 5 + TypeScript) do Labirinto do Saber, plataforma para educadores e
psicopedagogos que atendem crianças com dificuldade de aprendizagem. O domínio é em PT-BR
(anamnese, caderno, atendimento), e o código usa nomes em inglês.

## Stack

- Node 20/22, TypeScript strict (CommonJS), pnpm.
- Express 5 + `@wave-telecom/framework` (`BaseController`, `success`/`failure`, `Uuid`).
- Prisma 6 + MongoDB. IDs são UUID gerados no domínio e gravados em `_id`.
- Zod para validação, JWT + bcrypt, multer (memória) + AWS S3, nodemailer.
- Gemini (`@google/genai`) para IA; Upstash QStash + cron da Vercel para lembretes.
- Deploy na Vercel (função serverless única, região `gru1`).

## Comandos

- `npx tsc --noEmit`: checagem de tipos. Também é o build (`pnpm build` = `tsc`). Não há lint.
- `npx vitest run`: testes unitários. Exclui `*.integration.spec.ts`.
- `pnpm test:integration`: testes que chamam o Gemini de verdade (precisa de `GEMINI_API_KEY`).
- `npx prisma generate`: obrigatório depois de mudar `prisma/schema.prisma`. Leva alguns minutos;
  rode em background.
- Husky: build no pre-commit, testes no pre-push. CI roda build e testes em Node 20 e 22.

Os testes rodam normalmente no Windows nativo. **Não rode vitest pelo WSL**: o pnpm instalou
binários nativos do Windows (`rollup-win32`) e o vitest falha com `MODULE_NOT_FOUND` para
`@rollup/rollup-linux-x64-gnu`. Nunca instale variantes de rollup com `pnpm add` para
contornar isso.

## Arquitetura (Clean Architecture)

```
src/domain/            entidades, interfaces de repositório e portas de serviço (sem Prisma/Express)
src/application/
  routes/index.ts      monta os routers dos módulos
  modules/<modulo>/
    routes/index.ts    instancia repositórios (factories) e use cases; registra as rotas
    schemas/*.ts       schemas Zod
    use-cases/<caso>/  <caso>-controller.ts, <caso>-use-case.ts, <caso>-use-case.spec.ts
src/infraestructure/   (grafia do projeto, não corrigir)
  factories/index.ts   make*Repository / make*Service com um PrismaClient compartilhado
  repositories/prisma/ implementações dos repositórios
  services/            JWT, S3, mail, Gemini (+ prompts/), QStash
  mappers/             entidade → JSON de resposta
  middlewares/         makeAuthMiddleware, requireJobApiKey, erro do multer
```

Para uma feature nova, siga um módulo existente (`appointment`, `task-notebook-session`) como
modelo.

## Padrões de código

- **Erros como valor.** O use case devolve `success(valor)` ou `failure("CODIGO_EM_MAIUSCULAS")`.
  `failure` aceita qualquer payload. O controller traduz cada código num `switch` para
  `this.notFound`, `this.clientError`, `this.fail` ou `res.status(4xx).json({ message })`.
  Exceções só aparecem na borda com serviços externos (Gemini, S3); o use case faz `try/catch`
  e converte para um código (`AI_GENERATION_FAILED`).
- **Controller.** Estende `BaseController` e implementa `executeImpl`. Valida com
  `schema.safeParseAsync`; em caso de erro, devolve
  `this.clientError(res, undefined, formatValidationErrors(...))`. O educador vem sempre de
  `req.user` (preenchido pelo `authMiddleware`), nunca do corpo. O controller é instanciado a
  cada requisição dentro da rota.
- **Entidades.** Construtor privado, `static create(props)` (com validação, devolvendo `Result`
  quando há regra) e `static fromPersistence(props)` para o repositório.
  - As entidades novas são imutáveis: métodos devolvem uma instância nova (`Appointment`,
    `Plan`, `TaskNotebookSession`).
  - Ao comparar `Uuid`, use `.value`, nunca `===` entre objetos.
- **Repositórios.**
  - `save` faz `upsert` por id.
  - Opcionais são gravados como `null` e lidos com `?? undefined`.
  - Arrays de tipos compostos usam `{ set: [...] }` no `update`.
  - Prefira buscas em lote (`getByIds`, `findMany({ where: { id: { in } } })`) a N+1.
- **MongoDB/Prisma.** Prefira subdocumentos embutidos (`type` no schema) quando os dados mudam
  junto com o pai. Assim a gravação é atômica sem `$transaction`. Índices seguem o padrão real
  de consulta (compostos, aproveitando o prefixo).
- **Simplicidade.** Código sequencial e direto. Não introduza transações, filas ou camadas de
  abstração sem necessidade comprovada.
- **Datas sem hora** (vigência, revisão) ficam como string `AAAA-MM-DD`, com os helpers de
  `src/domain/utils/date-only.ts`. "Hoje" é calculado em `America/Sao_Paulo`. Datas com hora
  ficam como `DateTime` em UTC.
- **IA.**
  - Porta em `src/domain/services`, implementação Gemini com `responseSchema` (JSON) e
    `withGeminiRetry`.
  - Prompts em `src/infraestructure/services/prompts`.
  - Valide a saída do modelo com as invariantes da entidade antes de devolver.
- **Dados de crianças.** Não logue conteúdo de anamnese, plano ou observação. Não envie nome,
  endereço, telefone ou documentos do paciente ao provedor de IA.
- **Propriedade.** Recurso de outro educador: o padrão das rotas novas é `403 UNAUTHORIZED`. O
  dono de um aluno é `Student.educatorId`.

## Testes

- Vitest, com o spec ao lado do use case. Specs de entidade ficam em `src/domain/tests/`.
- Repositórios e serviços são simulados com `vi.fn()`; as entidades usadas são reais.
- Asserções de erro: `expect(result).toEqual({ ok: false, error: "CODIGO" })`.
- Testes que chamam serviços externos de verdade ficam só em `*.integration.spec.ts`.

## Git

- Commits com gitmoji e mensagem em PT-BR: `✨ feat: ...`, `🐛 fix: ...`, `⚡️ perf: ...`.
- `main` é a branch principal; o trabalho é feito em branches de feature (`feat/...`, `perf/...`).
- Planejamento local (task, PRD, plano por fases) fica em `spec/`, que é ignorada pelo git
  (`.git/info/exclude`). Nunca cite fase, plano ou PRD em commit, PR ou nome de branch.
