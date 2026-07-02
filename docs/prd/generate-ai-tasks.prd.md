Task: Implementar um fluxo que permita a geração de tarefas por IA com validação do cliente.
Na .env desse projeto subi a API key do gemini que será utilizada para gerar as mensagens.
As entradas serão: publico alvo da atividade(Aqui o profissional vai poder falar sobre a idade do paciente, perfil de de deficiencia e dificuldades etc.), instruções(aqui o pacieinte vai descrever como ele quer as atividades suas denições), quantidade (inteiro de 1 a 15 que é a quantidade de tarefas que devem ser geradas.). Devem ser criados 2 novos endpoints 1 para gerar as tarefas (que não vão ser persistidas no banco, elas serão retornadas para o cliente que então validará) e 1 para salvar um grupo de atividades recebendo um array de atividades (que ainda não existem no banco , elas serão as que foram geradas + algumas q o cliente pode ter criado ou não na mão, o endpoint deve ser agnostico a isso). Vc deve seguir as convenções do projeto e não ferias suas estruturas arquiteturais.
TODOs: Cubra de testes as implementações, crie o prompt detalhado (vale ressaltar o cunho psicopedagogico da plataforma) que vai receber apenas as entradas do use-case, o prompt deve deixar claro como deve ser a estrutura parseavel, consuma o gemini via API.

Se tiver qualquer duvida me pergunte(faça no minimo 3 perguntas)

---

# Planejamento — Geração de Tarefas por IA (Gemini)

> Documento de planejamento gerado a partir da tarefa acima e da análise da
> estrutura atual do projeto. As decisões abaixo já incorporam as respostas do
> product owner às perguntas de esclarecimento.

## 1. Decisões confirmadas

| Tema | Decisão |
| --- | --- |
| **Categoria/mídia das tasks geradas** | `category` passa a ser uma **4ª entrada** da geração. Todas as tasks geradas herdam essa categoria e são do tipo `MultipleChoice` (texto puro — sem imagem/áudio, pois mídia exige upload). |
| **Endpoint de salvar (endpoint 2)** | Recebe **nome + categoria do grupo + array de atividades completas**. Persiste as tasks e cria um `TaskGroup` referenciando-as, de forma **atômica** (falha ⇒ nada é salvo). Agnóstico à origem (IA ou manual). As tasks **criadas na mão** podem ter `imageFile`/`audioFile` (URL já hospedada), então o item suporta `MultipleChoice` e `MultipleChoiceWithMedia`. |
| **Mídia na geração por IA** | **Fora de escopo por enquanto.** A IA gera apenas `MultipleChoice` (texto). Mídia só existe nas tasks adicionadas manualmente. |
| **Organização** | **Novo módulo `ai-task`** para a geração (`POST /ai-task/generate`); o salvamento em lote entra como **novo use-case no módulo `task` existente** (`POST /task/batch`). |
| **Integração Gemini** | Instalar o SDK oficial **`@google/genai`** (JS puro, sem binário nativo — deve ser instalado pelo usuário no shell Windows). Modelo `gemini-2.5-flash` com saída JSON estruturada (`responseMimeType: application/json` + `responseSchema`). |

## 2. Arquitetura-alvo (aderente ao Clean Architecture do projeto)

O projeto separa **domain** (entidades, repositórios, serviços = interfaces),
**infraestructure** (impls Prisma/serviços + factories) e **application**
(módulos → use-cases → controller/schema/route). A IA será modelada como um
**serviço de domínio abstrato** com implementação concreta em infra, exatamente
como `AppointmentSchedulerService` → `QStashAppointmentSchedulerImpl`.

```
Controller (valida body Zod, extrai req.user)
   → UseCase (regras: valida quantidade, invoca serviço, valida drafts via Task.create)
      → AiTaskGeneratorService (interface de domínio)
         → GeminiTaskGeneratorImpl (infra: monta prompt + chama @google/genai)
```

## 3. Contrato de dados (reuso da request de criar task)

**Não** será criado um DTO novo. O item de atividade é exatamente o **mesmo
contrato lógico do `POST /task/create`** (campos `category`, `type`, `prompt`,
`alternatives[]` e, opcionalmente, `imageFile`/`audioFile`), apenas usado como
**array**. A IA já devolve nesse formato, e o endpoint 2 aceita o mesmo, o que o
torna naturalmente agnóstico à origem (gerado pela IA ou criado na mão) **e à
presença de mídia**.

```ts
// = mesmo shape de createTaskSchema (extraído para reuso), porém com mídia por URL
interface TaskInput {
  category: TaskCategory;                 // reading | writing | vocabulary | comprehension
  type: TaskType;                         // MultipleChoice | MultipleChoiceWithMedia
  prompt: string;
  alternatives: { text: string; isCorrect: boolean }[]; // >= 2, exatamente 1 correta
  imageFile?: string;                     // URL já hospedada (opcional)
  audioFile?: string;                     // URL já hospedada (opcional)
}
```

- **Endpoint 1 (IA)** devolve `TaskInput[]` sempre como `MultipleChoice`, **sem
  mídia** (`imageFile`/`audioFile` nunca são preenchidos pela IA por enquanto).
- **Endpoint 2** recebe `{ name, category, tasks: TaskInput[] }` e persiste.
  Aceita itens com mídia porque uma parte deles pode ter sido **criada na mão**.
- **Diferença-chave vs. `/task/create`:** aquele endpoint é `multipart/form-data`
  e faz o upload do binário *na hora*. No fluxo em lote a **mídia entra por
  referência (URL)**: quem cria uma task na mão com imagem/áudio primeiro faz o
  upload (endpoint genérico — §4.3) e recebe a URL, depois a inclui no item. O
  batch em si é **JSON puro**.
- As invariantes de mídia (`MultipleChoiceWithMedia` exige imagem ou áudio;
  `MultipleChoice` não pode ter mídia) **não são reimplementadas**: passam de
  graça ao construir cada item via `Task.create`.
- A validação reaproveita o **mesmo `taskFieldsSchema`** (extraído de
  `createTaskSchema`, com `imageFile`/`audioFile` como URL opcional), envolto em
  `z.array(...)`.
- Serializar respostas sempre como **DTO**, nunca a entidade de domínio crua
  (segue o commit recente `serialize task-notebook list as DTO`).

## 4. Endpoints

### 4.1 `POST /ai-task/generate` — gerar (não persiste)
- **Auth:** `makeAuthMiddleware` (igual aos demais módulos).
- **Body:**
  ```json
  {
    "targetAudience": "string (publico-alvo: idade, perfil de deficiência, dificuldades)",
    "instructions": "string (como o profissional quer as atividades)",
    "quantity": 5,
    "category": "reading"
  }
  ```
- **Validações:** `quantity` inteiro 1–15; `category` ∈ `TaskCategory`;
  `targetAudience`/`instructions` não vazios.
- **Resposta 200:** `{ tasks: TaskInput[] }` (mesmo shape aceito pelo endpoint 2).
- **Erros:** `INVALID_QUANTITY`, `AI_GENERATION_FAILED`, `AI_INVALID_OUTPUT`.

### 4.2 `POST /task/batch` — salvar grupo de atividades (atômico)
- **Auth:** `makeAuthMiddleware`; educador vem de `req.user.email`.
- **Body:**
  ```json
  {
    "name": "Grupo de leitura - Turma A",
    "category": "reading",
    "tasks": [ /* TaskInput[] (mesmo shape de /task/create, mídia por URL) — gerados + manuais */ ]
  }
  ```
- **Comportamento:** valida cada task via `Task.create` (garante ≥2 alternativas,
  exatamente 1 correta e as regras de mídia); persiste todas as tasks; cria o
  `TaskGroup` com os `tasksIds`. Tudo ou nada.
- **Resposta 201:** `{ taskGroup: TaskGroupDTO, taskIds: string[] }`.
- **Erros:** `EDUCATOR_NOT_FOUND`, `INVALID_TASK_DATA`, `EMPTY_TASK_LIST`.

### 4.3 `POST /task/upload-media` — pré-upload de mídia (habilita mídia no batch)
- **Auth:** `makeAuthMiddleware`.
- **Entrada:** `multipart/form-data` com um arquivo (`file`), via Multer.
- **Comportamento:** reaproveita `FileStorage.saveFile` (mesmo padrão de
  `upload-anamnese-file`), com chave `Uuid.random()`; devolve a URL pública.
- **Resposta 200:** `{ url: string }`.
- **Uso:** o cliente sobe cada imagem/áudio de uma task manual aqui, pega a URL e
  a coloca em `imageFile`/`audioFile` do item antes de chamar `/task/batch`.
  (A geração por IA não usa este endpoint — ela não produz mídia.)

## 5. Arquivos a criar / modificar

### Domain
- **CRIAR** `src/domain/services/ai-task-generator-service.ts`
  - `interface GenerateTasksParams { targetAudience; instructions; quantity; category }`
  - `interface GeneratedTaskDraft { category; type; prompt; alternatives[] }`
  - `interface AiTaskGeneratorService { generate(params): Promise<GeneratedTaskDraft[]> }`
- **MODIFICAR** `src/domain/repositories/task-repository.ts`
  - Adicionar `saveMany(tasks: Task[]): Promise<void>` (persistência em lote).

### Infraestructure
- **CRIAR** `src/infraestructure/services/gemini-task-generator-impl.ts`
  - Implementa `AiTaskGeneratorService` usando `@google/genai` (`GEMINI_API_KEY`).
  - Usa `responseMimeType: "application/json"` + `responseSchema` para forçar
    saída parseável; faz `JSON.parse` defensivo e lança/normaliza erro em caso
    de saída inválida (mapeado para `AI_INVALID_OUTPUT`).
- **CRIAR** `src/infraestructure/services/prompts/generate-tasks-prompt.ts`
  - Função pura que recebe **apenas** as entradas do use-case e devolve o prompt
    (ver seção 6). Facilita teste unitário do prompt.
- **MODIFICAR** `src/infraestructure/repositories/prisma/task-repository-impl.ts`
  - Implementar `saveMany` (idealmente `createMany` / dentro de transação — ver §7).
- **MODIFICAR** `src/infraestructure/repositories/mock/task-repository-impl.ts`
  - Implementar `saveMany` no mock.
- **MODIFICAR** `src/infraestructure/factories/index.ts`
  - Adicionar `makeAiTaskGeneratorService(): AiTaskGeneratorService`.

### Application — módulo novo `ai-task`
- **CRIAR** `src/application/modules/ai-task/use-cases/generate-tasks/generate-tasks-use-case.ts`
  - Valida `quantity` (1–15); chama o serviço; valida cada draft via `Task.create`
    (descarta/rejeita inválidas); retorna `TaskDraftDTO[]`. **Não persiste.**
- **CRIAR** `.../generate-tasks/generate-tasks-controller.ts`
- **CRIAR** `.../generate-tasks/generate-tasks-use-case.spec.ts`
- **CRIAR** `src/application/modules/ai-task/schemas/generate-tasks-schema.ts` (Zod)
- **CRIAR** `src/application/modules/ai-task/routes/index.ts` (wire factories + auth)

### Application — módulo existente `task`
- **CRIAR** `src/application/modules/task/use-cases/save-task-batch/save-task-batch-use-case.ts`
  - Depende de `TaskRepository`, `TaskGroupRepository`, `EducatorRepository`.
  - Valida educador; valida cada task; `saveMany`; cria `TaskGroup`.
- **CRIAR** `.../save-task-batch/save-task-batch-controller.ts`
- **CRIAR** `.../save-task-batch/save-task-batch-use-case.spec.ts`
- **MODIFICAR** `src/application/modules/task/schemas/create-task-schemas.ts`
  - Extrair o objeto de campos para um `taskFieldsSchema` exportado, incluindo
    `imageFile`/`audioFile` como `z.string().url().optional()`. Manter
    `createTaskSchema` como está para o fluxo multipart atual.
- **CRIAR** `src/application/modules/task/schemas/save-task-batch-schema.ts`
  - `z.object({ name, category, tasks: z.array(taskFieldsSchema).min(1) })` —
    reutiliza o mesmo contrato de criar task, com mídia por URL.
- **CRIAR** `src/application/modules/task/use-cases/upload-task-media/` (use-case +
  controller) — espelha `upload-anamnese-file`, injeta `FileStorage`.
- **MODIFICAR** `src/application/modules/task/routes/index.ts` → registrar
  `POST /batch` e `POST /upload-media` (este com `Multer.getUploader`).

### Roteamento raiz
- **MODIFICAR** `src/application/routes/index.ts` → `router.use("/ai-task", aiTaskRouter)`.

## 6. Prompt (cunho psicopedagógico)

Arquivo `generate-tasks-prompt.ts` recebe **apenas** `targetAudience`,
`instructions`, `quantity`, `category`. Diretrizes do prompt:

1. **Persona/contexto:** especialista em **psicopedagogia** que cria atividades
   inclusivas para a plataforma Labirinto do Saber, adaptadas a perfis de
   deficiência e dificuldades de aprendizagem.
2. **Entradas:** injeta público-alvo, instruções, categoria e quantidade.
3. **Regras pedagógicas:** linguagem acessível e adequada à idade/perfil;
   enunciados claros e objetivos; alternativas plausíveis (sem "pegadinhas"
   ambíguas); reforço positivo; coerência com a categoria escolhida.
4. **Contrato de saída estritamente parseável:** JSON puro (sem markdown), array
   com exatamente `quantity` itens, cada item no formato:
   ```json
   { "prompt": "…", "alternatives": [ { "text": "…", "isCorrect": true }, { "text": "…", "isCorrect": false } ] }
   ```
   Exige **≥ 2 alternativas** e **exatamente 1** `isCorrect: true` (espelha as
   invariantes de `Task.validateTaskStructure`). `category`/`type` são aplicados
   pelo use-case, não pela IA.
5. Reforçado no código via `responseSchema` do `@google/genai`.

## 7. Persistência (sem transação — decisão do PO)

Optou-se por **não** usar transação/atomicidade. O fluxo é sequencial e direto:
1. `taskRepository.saveMany(tasks)` persiste as atividades (loop de `save`).
2. `taskGroupRepository.save(group)` cria o grupo referenciando os `tasksIds`.

Toda a validação de domínio (`Task.create`) acontece **antes** de qualquer
escrita, então uma task malformada aborta o request sem gravar nada. Falhas de
infraestrutura no meio do processo são improváveis e, se ocorrerem, no máximo
deixam tasks salvas sem grupo — aceitável para o caso de uso.

## 8. Testes (Vitest)

Seguindo o padrão dos `*-use-case.spec.ts` (mocks manuais com `vi.fn()`):
- **generate-tasks-use-case.spec:** mock de `AiTaskGeneratorService`; casos:
  quantidade fora de 1–15 → `INVALID_QUANTITY`; sucesso retorna N drafts;
  serviço lança → `AI_GENERATION_FAILED`; draft inválido (0 corretas) tratado.
- **save-task-batch-use-case.spec:** mocks de `TaskRepository`/`TaskGroupRepository`/
  `EducatorRepository`; casos: educador inexistente; lista vazia; task inválida;
  sucesso persiste todas + cria grupo; falha no grupo não deixa tasks órfãs.
- **generate-tasks-prompt** (opcional): teste puro garantindo que as entradas
  aparecem e que o contrato JSON está descrito.
- Mock da geração via SDK `@google/genai` na spec da impl (sem chamar rede real).
- **Não rodar `pnpm test` pelo agente** (ver `CLAUDE.md`): apenas `tsc --noEmit`
  e o usuário roda os testes no shell Windows.

## 9. Dependência a instalar (usuário, no Windows)

```
pnpm add @google/genai
```
Confirmar que `GEMINI_API_KEY` está no `.env` (já está) e é lido pela impl.

## 10. Ordem de implementação sugerida

1. Instalar `@google/genai` + interface `AiTaskGeneratorService`.
2. `generate-tasks-prompt.ts` + `GeminiTaskGeneratorImpl` + factory.
3. Módulo `ai-task` (schema → use-case → controller → route) + registro no router raiz.
4. `saveMany` no repositório (interface, prisma, mock).
5. Endpoint `POST /task/upload-media` (use-case + controller, espelhando `upload-anamnese-file`).
6. Extração do `taskFieldsSchema` (com mídia por URL) + schema do batch.
7. Use-case `save-task-batch` no módulo `task` (use-case → controller → route `POST /batch`).
8. Specs de todos os use-cases.
9. `tsc --noEmit` e handoff dos testes para o usuário.

