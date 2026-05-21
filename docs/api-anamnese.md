# API — Módulo Anamnese

## Visão Geral

O módulo de anamnese permite que profissionais criem formulários de avaliação (**templates**) e os respondam junto ao aluno (**responses**). O fluxo de uso é sempre:

1. Profissional cria um template com as perguntas
2. Profissional busca o template para exibir o formulário
3. Profissional preenche e envia todas as respostas em uma única requisição

> **Autenticação:** Todos os endpoints exigem o header `Authorization: Bearer <token>`. O token é obtido no endpoint de login do educador.

---

## Índice

- [Tipos Globais](#tipos-globais)
- [Templates](#templates)
  - [Criar template](#post-anamnestemplates)
  - [Listar templates](#get-anamnestemplates)
  - [Buscar template](#get-anamnesetemplatestemplateid)
  - [Atualizar template](#put-anamnesetemplatestemplateid)
  - [Deletar template](#delete-anamnesetemplatestemplateid)
- [Respostas](#respostas)
  - [Enviar resposta](#post-anamnesetemplatestemplateidresponses)
  - [Listar respostas por aluno](#get-anamneseresponsesstudentstudenid)
  - [Buscar resposta](#get-anamneseresponsesresponseid)
- [Fluxo de Integração Completo](#fluxo-de-integração-completo)
- [Tabela de Erros](#tabela-de-erros)

---

## Tipos Globais

### `AnamneseQuestionType`

```ts
type AnamneseQuestionType =
  | "Descriptive"    // Campo de texto livre
  | "MultipleChoice" // Exatamente 1 opção selecionada
  | "Checkbox"       // 1 ou mais opções selecionadas
  | "FileUpload"     // URL de arquivo (laudo, relatório, etc.)
```

### `AnamneseQuestionOption`

```ts
interface AnamneseQuestionOption {
  id: string;   // UUID gerado pelo servidor
  text: string;
}
```

### `AnamneseQuestion`

```ts
interface AnamneseQuestion {
  id: string;                     // UUID gerado pelo servidor
  text: string;                   // Enunciado da pergunta
  type: AnamneseQuestionType;
  required: boolean;              // Se a resposta é obrigatória
  order: number;                  // Ordem de exibição (0-indexed)
  options: AnamneseQuestionOption[]; // Preenchido apenas para MultipleChoice e Checkbox
}
```

### `AnamneseTemplate`

```ts
interface AnamneseTemplate {
  id: string;
  educatorId: string;
  title: string;
  description?: string;
  questions: AnamneseQuestion[];
  createdAt: string; // ISO 8601
}
```

### `AnamneseAnswer`

```ts
interface AnamneseAnswer {
  questionId: string;             // ID da pergunta no template
  questionType: AnamneseQuestionType;
  textValue?: string;             // Preenchido quando questionType = "Descriptive"
  selectedOptionId?: string;      // Preenchido quando questionType = "MultipleChoice"
  selectedOptionIds?: string[];   // Preenchido quando questionType = "Checkbox"
  fileUrl?: string;               // Preenchido quando questionType = "FileUpload"
}
```

### `AnamneseResponse`

```ts
interface AnamneseResponse {
  id: string;
  templateId: string;
  educatorId: string;
  studentId: string;
  answers: AnamneseAnswer[];
  answeredAt: string; // ISO 8601
}
```

---

## Templates

### `POST /anamnese/templates`

Cria um novo template de anamnese para o profissional autenticado.

**Regras de negócio:**
- `MultipleChoice` e `Checkbox` exigem ao menos 2 opções em `options`
- `Descriptive` e `FileUpload` não usam `options`
- Os IDs das perguntas e opções são gerados pelo servidor

#### Request

```ts
// Headers
Authorization: Bearer <token>
Content-Type: application/json

// Body
interface CreateAnamneseTemplateRequest {
  title: string;         // obrigatório, máx 200 caracteres
  description?: string;  // opcional, máx 1000 caracteres
  questions: {
    text: string;                  // enunciado da pergunta
    type: AnamneseQuestionType;
    required: boolean;
    options?: { text: string }[];  // obrigatório para MultipleChoice e Checkbox
  }[];
}
```

**Exemplo de body:**

```json
{
  "title": "Anamnese Autismo Infantil",
  "description": "Formulário de avaliação inicial para TEA",
  "questions": [
    {
      "text": "A criança apresenta dificuldades na interação social?",
      "type": "MultipleChoice",
      "required": true,
      "options": [
        { "text": "Sim" },
        { "text": "Não" },
        { "text": "Às vezes" }
      ]
    },
    {
      "text": "Descreva o histórico de desenvolvimento da criança.",
      "type": "Descriptive",
      "required": false
    },
    {
      "text": "Quais sintomas foram observados?",
      "type": "Checkbox",
      "required": true,
      "options": [
        { "text": "Dificuldade de concentração" },
        { "text": "Hiperatividade" },
        { "text": "Impulsividade" },
        { "text": "Dificuldade em seguir regras" }
      ]
    },
    {
      "text": "Anexe o laudo médico, se houver.",
      "type": "FileUpload",
      "required": false
    }
  ]
}
```

#### Response `201 Created`

Retorna o template criado com os IDs gerados pelo servidor.

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "educatorId": "fed1b2c3-e4f5-6789-abcd-012345678901",
  "title": "Anamnese Autismo Infantil",
  "description": "Formulário de avaliação inicial para TEA",
  "createdAt": "2026-05-21T10:00:00.000Z",
  "questions": [
    {
      "id": "11111111-1111-1111-1111-111111111111",
      "text": "A criança apresenta dificuldades na interação social?",
      "type": "MultipleChoice",
      "required": true,
      "order": 0,
      "options": [
        { "id": "aaaa0001-...", "text": "Sim" },
        { "id": "aaaa0002-...", "text": "Não" },
        { "id": "aaaa0003-...", "text": "Às vezes" }
      ]
    },
    {
      "id": "22222222-2222-2222-2222-222222222222",
      "text": "Descreva o histórico de desenvolvimento da criança.",
      "type": "Descriptive",
      "required": false,
      "order": 1,
      "options": []
    },
    {
      "id": "33333333-3333-3333-3333-333333333333",
      "text": "Quais sintomas foram observados?",
      "type": "Checkbox",
      "required": true,
      "order": 2,
      "options": [
        { "id": "bbbb0001-...", "text": "Dificuldade de concentração" },
        { "id": "bbbb0002-...", "text": "Hiperatividade" },
        { "id": "bbbb0003-...", "text": "Impulsividade" },
        { "id": "bbbb0004-...", "text": "Dificuldade em seguir regras" }
      ]
    },
    {
      "id": "44444444-4444-4444-4444-444444444444",
      "text": "Anexe o laudo médico, se houver.",
      "type": "FileUpload",
      "required": false,
      "order": 3,
      "options": []
    }
  ]
}
```

#### Status Codes

| Status | Situação |
|--------|----------|
| `201` | Template criado com sucesso |
| `400` | Body inválido (campo faltando, tipo inválido, MultipleChoice/Checkbox sem opções suficientes) |
| `401` | Token ausente ou inválido |
| `500` | Erro interno do servidor |

---

### `GET /anamnese/templates`

Lista todos os templates do profissional autenticado, ordenados do mais recente ao mais antigo.

#### Request

```
// Headers
Authorization: Bearer <token>
```

#### Response `200 OK`

```ts
AnamneseTemplate[] // array, pode ser vazio
```

```json
[
  {
    "id": "a1b2c3d4-...",
    "educatorId": "fed1b2c3-...",
    "title": "Anamnese Autismo Infantil",
    "description": "Formulário de avaliação inicial para TEA",
    "createdAt": "2026-05-21T10:00:00.000Z",
    "questions": [ ... ]
  },
  {
    "id": "b2c3d4e5-...",
    "educatorId": "fed1b2c3-...",
    "title": "Anamnese TDAH",
    "description": null,
    "createdAt": "2026-05-20T08:30:00.000Z",
    "questions": [ ... ]
  }
]
```

#### Status Codes

| Status | Situação |
|--------|----------|
| `200` | Sucesso (array vazio se não houver templates) |
| `401` | Token ausente ou inválido |

---

### `GET /anamnese/templates/:templateId`

Busca um template específico pelo ID. Usado pelo front-end para montar o formulário antes de responder.

> **Importante:** Guarde os IDs das perguntas e das opções retornados nesse endpoint — eles serão obrigatórios ao enviar as respostas.

#### Request

```
// Headers
Authorization: Bearer <token>

// Params
templateId: string (UUID)
```

#### Response `200 OK`

```ts
AnamneseTemplate
```

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "educatorId": "fed1b2c3-...",
  "title": "Anamnese Autismo Infantil",
  "description": "Formulário de avaliação inicial para TEA",
  "createdAt": "2026-05-21T10:00:00.000Z",
  "questions": [
    {
      "id": "11111111-1111-1111-1111-111111111111",
      "text": "A criança apresenta dificuldades na interação social?",
      "type": "MultipleChoice",
      "required": true,
      "order": 0,
      "options": [
        { "id": "aaaa0001-...", "text": "Sim" },
        { "id": "aaaa0002-...", "text": "Não" },
        { "id": "aaaa0003-...", "text": "Às vezes" }
      ]
    }
  ]
}
```

#### Status Codes

| Status | Situação |
|--------|----------|
| `200` | Template encontrado |
| `401` | Token ausente ou inválido; ou template pertence a outro profissional |
| `404` | Template não encontrado |

---

### `PUT /anamnese/templates/:templateId`

Atualiza um template existente. **Bloqueado se o template já tiver respostas** — isso protege o rastreio histórico.

**O que pode ser atualizado:** `title`, `description` e `questions` (as perguntas são completamente substituídas e recebem novos IDs).

#### Request

```ts
// Headers
Authorization: Bearer <token>
Content-Type: application/json

// Params
templateId: string (UUID)

// Body (todos os campos são opcionais)
interface UpdateAnamneseTemplateRequest {
  title?: string;
  description?: string;
  questions?: {
    text: string;
    type: AnamneseQuestionType;
    required: boolean;
    options?: { text: string }[];
  }[];
}
```

**Exemplo de body:**

```json
{
  "title": "Anamnese Autismo Infantil — Revisada",
  "questions": [
    {
      "text": "A criança apresenta dificuldades na interação social?",
      "type": "MultipleChoice",
      "required": true,
      "options": [
        { "text": "Sim" },
        { "text": "Não" },
        { "text": "Às vezes" },
        { "text": "Não observado" }
      ]
    }
  ]
}
```

#### Response `200 OK`

Retorna o template atualizado (estrutura idêntica ao `POST`).

#### Status Codes

| Status | Situação |
|--------|----------|
| `200` | Template atualizado com sucesso |
| `400` | Body inválido; ou template já tem respostas (`TEMPLATE_HAS_RESPONSES`) |
| `401` | Token ausente ou inválido; ou template pertence a outro profissional |
| `404` | Template não encontrado |

#### Cenário de Bloqueio

Ao tentar atualizar um template que já teve respostas submetidas:

```json
// 400 Bad Request
{
  "error": "TEMPLATE_HAS_RESPONSES"
}
```

---

### `DELETE /anamnese/templates/:templateId`

Remove um template. **Também bloqueado se já tiver respostas.**

#### Request

```
// Headers
Authorization: Bearer <token>

// Params
templateId: string (UUID)
```

#### Response `200 OK`

```json
null
```

#### Status Codes

| Status | Situação |
|--------|----------|
| `200` | Template deletado com sucesso |
| `400` | Template já possui respostas (`TEMPLATE_HAS_RESPONSES`) |
| `401` | Token ausente ou inválido; ou template pertence a outro profissional |
| `404` | Template não encontrado |

---

## Respostas

### `POST /anamnese/templates/:templateId/responses`

Envia as respostas de um aluno para um template em uma única requisição. O profissional deve ter buscado o template previamente (`GET /anamnese/templates/:templateId`) para obter os IDs das perguntas e opções.

**Regras de validação:**
- Perguntas com `required: true` devem obrigatoriamente ter uma entrada em `answers`
- Perguntas com `required: false` podem ser omitidas de `answers`
- Cada resposta deve usar apenas o campo correspondente ao tipo da pergunta (ver tabela abaixo)
- `selectedOptionId` e `selectedOptionIds` devem ser IDs válidos do template

#### Regras por tipo de pergunta

| `questionType` | Campo obrigatório na resposta | Campos ignorados |
|---------------|-------------------------------|------------------|
| `Descriptive` | `textValue` | `selectedOptionId`, `selectedOptionIds`, `fileUrl` |
| `MultipleChoice` | `selectedOptionId` (1 opção válida) | `textValue`, `selectedOptionIds`, `fileUrl` |
| `Checkbox` | `selectedOptionIds` (array não vazio, todos válidos) | `textValue`, `selectedOptionId`, `fileUrl` |
| `FileUpload` | `fileUrl` (URL válida) | `textValue`, `selectedOptionId`, `selectedOptionIds` |

#### Request

```ts
// Headers
Authorization: Bearer <token>
Content-Type: application/json

// Params
templateId: string (UUID)

// Body
interface SubmitAnamneseResponseRequest {
  studentId: string; // UUID do aluno
  answers: {
    questionId: string;           // UUID da pergunta (vem do GET template)
    textValue?: string;           // para Descriptive
    selectedOptionId?: string;    // para MultipleChoice (UUID da opção)
    selectedOptionIds?: string[]; // para Checkbox (array de UUIDs das opções)
    fileUrl?: string;             // para FileUpload (URL do arquivo já enviado)
  }[];
}
```

**Exemplo de body** (usando os IDs do template do exemplo anterior):

```json
{
  "studentId": "c3d4e5f6-a7b8-9012-cdef-345678901234",
  "answers": [
    {
      "questionId": "11111111-1111-1111-1111-111111111111",
      "selectedOptionId": "aaaa0001-..."
    },
    {
      "questionId": "22222222-2222-2222-2222-222222222222",
      "textValue": "A criança nasceu prematura com 32 semanas. Primeiros sinais de atraso na fala foram notados aos 2 anos."
    },
    {
      "questionId": "33333333-3333-3333-3333-333333333333",
      "selectedOptionIds": ["bbbb0001-...", "bbbb0002-..."]
    }
  ]
}
```

> Nota: A pergunta `44444444-...` (FileUpload, `required: false`) foi omitida — isso é permitido por ser opcional.

#### Response `200 OK`

```ts
AnamneseResponse
```

```json
{
  "id": "d4e5f6a7-b8c9-0123-def0-456789012345",
  "templateId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "educatorId": "fed1b2c3-...",
  "studentId": "c3d4e5f6-a7b8-9012-cdef-345678901234",
  "answeredAt": "2026-05-21T14:30:00.000Z",
  "answers": [
    {
      "questionId": "11111111-1111-1111-1111-111111111111",
      "questionType": "MultipleChoice",
      "selectedOptionId": "aaaa0001-..."
    },
    {
      "questionId": "22222222-2222-2222-2222-222222222222",
      "questionType": "Descriptive",
      "textValue": "A criança nasceu prematura com 32 semanas. Primeiros sinais de atraso na fala foram notados aos 2 anos."
    },
    {
      "questionId": "33333333-3333-3333-3333-333333333333",
      "questionType": "Checkbox",
      "selectedOptionIds": ["bbbb0001-...", "bbbb0002-..."]
    }
  ]
}
```

#### Status Codes

| Status | Situação |
|--------|----------|
| `200` | Resposta salva com sucesso |
| `400` | Body inválido; resposta ausente para pergunta obrigatória; ID de opção inválido; etc. |
| `401` | Token ausente ou inválido |
| `404` | Template não encontrado; aluno não encontrado |

#### Cenários de Erro (400)

| `error` retornado | Causa |
|-------------------|-------|
| `MISSING_REQUIRED_ANSWER` | Pergunta obrigatória sem resposta no array `answers` |
| `INVALID_QUESTION_ID` | `questionId` não existe no template |
| `MISSING_TEXT_VALUE` | Pergunta `Descriptive` sem `textValue` |
| `MISSING_SELECTED_OPTION` | Pergunta `MultipleChoice` sem `selectedOptionId` |
| `MISSING_SELECTED_OPTIONS` | Pergunta `Checkbox` sem `selectedOptionIds` ou array vazio |
| `MISSING_FILE_URL` | Pergunta `FileUpload` sem `fileUrl` |
| `INVALID_OPTION_ID` | `selectedOptionId` ou item de `selectedOptionIds` não existe nas opções da pergunta |

---

### `GET /anamnese/responses/student/:studentId`

Lista todas as respostas de anamnese de um aluno, ordenadas da mais recente para a mais antiga.

#### Request

```
// Headers
Authorization: Bearer <token>

// Params
studentId: string (UUID)
```

#### Response `200 OK`

```ts
AnamneseResponse[] // array, pode ser vazio
```

```json
[
  {
    "id": "d4e5f6a7-...",
    "templateId": "a1b2c3d4-...",
    "educatorId": "fed1b2c3-...",
    "studentId": "c3d4e5f6-...",
    "answeredAt": "2026-05-21T14:30:00.000Z",
    "answers": [ ... ]
  },
  {
    "id": "e5f6a7b8-...",
    "templateId": "b2c3d4e5-...",
    "educatorId": "fed1b2c3-...",
    "studentId": "c3d4e5f6-...",
    "answeredAt": "2026-03-10T09:00:00.000Z",
    "answers": [ ... ]
  }
]
```

#### Status Codes

| Status | Situação |
|--------|----------|
| `200` | Sucesso (array vazio se não houver respostas) |
| `401` | Token ausente ou inválido |

---

### `GET /anamnese/responses/:responseId`

Busca uma resposta específica pelo ID. Só retorna se o profissional autenticado for o mesmo que a criou.

#### Request

```
// Headers
Authorization: Bearer <token>

// Params
responseId: string (UUID)
```

#### Response `200 OK`

```ts
AnamneseResponse
```

#### Status Codes

| Status | Situação |
|--------|----------|
| `200` | Resposta encontrada |
| `401` | Token ausente ou inválido; ou resposta pertence a outro profissional |
| `404` | Resposta não encontrada |

---

## Fluxo de Integração Completo

A seguir, o passo a passo completo para integrar o módulo do zero.

### Passo 1 — Criar o template

```
POST /anamnese/templates
```

Crie o template com todas as perguntas. Guarde o `id` retornado.

```js
const { id: templateId, questions } = await api.post('/anamnese/templates', {
  title: 'Anamnese Autismo Infantil',
  questions: [...]
});
```

---

### Passo 2 — Listar templates (tela de seleção)

```
GET /anamnese/templates
```

Use para exibir a lista de templates disponíveis na tela de seleção do profissional.

---

### Passo 3 — Buscar o template completo (antes de responder)

```
GET /anamnese/templates/:templateId
```

Busque o template para montar o formulário. Os IDs de perguntas e opções retornados aqui são obrigatórios no próximo passo.

```js
const template = await api.get(`/anamnese/templates/${templateId}`);
// Exiba template.questions para o profissional preencher
```

---

### Passo 4 — Enviar as respostas

```
POST /anamnese/templates/:templateId/responses
```

Após o profissional preencher o formulário, envie todas as respostas de uma vez. Monte o array `answers` usando os IDs vindos do Passo 3.

```js
// Exemplo de construção do payload no front-end:
const answers = template.questions
  .filter(q => form[q.id] !== undefined) // omite perguntas opcionais não respondidas
  .map(q => {
    const base = { questionId: q.id };
    if (q.type === 'Descriptive')    return { ...base, textValue: form[q.id] };
    if (q.type === 'MultipleChoice') return { ...base, selectedOptionId: form[q.id] };
    if (q.type === 'Checkbox')       return { ...base, selectedOptionIds: form[q.id] };
    if (q.type === 'FileUpload')     return { ...base, fileUrl: form[q.id] };
  });

const response = await api.post(`/anamnese/templates/${templateId}/responses`, {
  studentId: selectedStudent.id,
  answers,
});
```

---

### Passo 5 — Consultar histórico do aluno

```
GET /anamnese/responses/student/:studentId
```

Use para exibir o histórico de avaliações de um aluno. Combine com o `templateId` de cada resposta para buscar o template correspondente e exibir o texto das perguntas.

---

## Tabela de Erros

| HTTP | `error` | Descrição |
|------|---------|-----------|
| `400` | `TEMPLATE_HAS_RESPONSES` | Tentativa de editar ou deletar template com respostas vinculadas |
| `400` | `INVALID_TEMPLATE_DATA` | Dados do template inválidos na atualização |
| `400` | `MISSING_REQUIRED_ANSWER` | Pergunta obrigatória sem resposta |
| `400` | `INVALID_QUESTION_ID` | `questionId` não pertence ao template |
| `400` | `MISSING_TEXT_VALUE` | Pergunta `Descriptive` sem `textValue` |
| `400` | `MISSING_SELECTED_OPTION` | Pergunta `MultipleChoice` sem `selectedOptionId` |
| `400` | `MISSING_SELECTED_OPTIONS` | Pergunta `Checkbox` sem `selectedOptionIds` ou vazio |
| `400` | `MISSING_FILE_URL` | Pergunta `FileUpload` sem `fileUrl` |
| `400` | `INVALID_OPTION_ID` | ID de opção não existe na pergunta |
| `401` | — | Token inválido ou recurso pertence a outro profissional |
| `404` | `TEMPLATE_NOT_FOUND` | Template não encontrado |
| `404` | `STUDENT_NOT_FOUND` | Aluno não encontrado |
| `404` | `RESPONSE_NOT_FOUND` | Resposta não encontrada |
| `500` | `INTERNAL_SERVER_ERROR` | Erro inesperado no servidor |
