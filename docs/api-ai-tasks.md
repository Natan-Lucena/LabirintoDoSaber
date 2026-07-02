# API — Geração de Atividades por IA e Salvamento em Lote

**Base URL:** `https://labirinto-do-saber.vercel.app`

Fluxo em três partes:

1. **`POST /ai-task/generate`** — gera atividades com IA (Gemini). **Não persiste
   nada**; devolve as atividades para o profissional revisar/editar.
2. **`POST /task/upload-media`** — (opcional) sobe uma imagem/áudio de uma
   atividade criada manualmente e devolve a URL.
3. **`POST /task/batch`** — persiste um conjunto de atividades (geradas pela IA
   e/ou criadas na mão) e cria um `TaskGroup` que as agrupa.

Todas as rotas exigem autenticação via Bearer token.

---

## Autenticação

Inclua o header em todas as requisições:

```
Authorization: Bearer <token>
```

---

## Enums

| Enum | Valores | Descrição |
|---|---|---|
| `TaskCategory` | `"reading"`, `"writing"`, `"vocabulary"`, `"comprehension"` | Categoria pedagógica da atividade |
| `TaskType` | `"multipleChoice"`, `"multipleChoiceWithMedia"` | Tipo da atividade |

---

## Objeto `TaskInput`

Formato de uma atividade. É **o mesmo** produzido pela geração por IA e aceito
pelo salvamento em lote — por isso o fluxo é agnóstico à origem (IA ou manual).

```json
{
  "category": "reading",
  "type": "multipleChoice",
  "prompt": "Qual palavra rima com 'gato'?",
  "alternatives": [
    { "text": "Pato", "isCorrect": true },
    { "text": "Cadeira", "isCorrect": false }
  ],
  "imageFile": "https://cdn.exemplo.com/img.png",
  "audioFile": "https://cdn.exemplo.com/audio.mp3"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `category` | `TaskCategory` | ✅ | Categoria pedagógica |
| `type` | `TaskType` | ✅ | Tipo da atividade |
| `prompt` | `string` (mín. 1) | ✅ | Enunciado da atividade |
| `alternatives` | `Alternative[]` (mín. 2) | ✅ | Alternativas; **exatamente 1** com `isCorrect: true` |
| `imageFile` | `string (url)` | ❌ | URL da imagem (somente `multipleChoiceWithMedia`) |
| `audioFile` | `string (url)` | ❌ | URL do áudio (somente `multipleChoiceWithMedia`) |

**Objeto `Alternative`**

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `text` | `string` (mín. 1) | ✅ | Texto da alternativa |
| `isCorrect` | `boolean` | ✅ | Se é a resposta correta |

> **Regras de mídia** (validadas pelo servidor): atividades `multipleChoice` **não
> podem** ter `imageFile`/`audioFile`; atividades `multipleChoiceWithMedia`
> **precisam** de pelo menos um dos dois. As atividades geradas pela IA são
> sempre `multipleChoice` (texto puro).

---

## Endpoints

### 1. Gerar atividades por IA

```
POST /ai-task/generate
```

Gera atividades de múltipla escolha (texto) com base no público-alvo e nas
instruções do profissional. **Nenhuma atividade é salva** — o retorno serve para
revisão antes de enviar ao `POST /task/batch`.

**Body**

```json
{
  "targetAudience": "Criança de 7 anos com dislexia, dificuldade em rimas",
  "instructions": "Atividades curtas de rima, com vocabulário simples",
  "quantity": 5,
  "category": "reading"
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `targetAudience` | `string` (mín. 1) | ✅ | Público-alvo: idade, perfil de deficiência, dificuldades |
| `instructions` | `string` (mín. 1) | ✅ | Como o profissional quer as atividades |
| `quantity` | `integer` (1–15) | ✅ | Quantidade de atividades a gerar |
| `category` | `TaskCategory` | ✅ | Categoria pedagógica aplicada a todas as atividades geradas |

**Resposta — 200 OK**

```json
{
  "tasks": [
    {
      "category": "reading",
      "type": "multipleChoice",
      "prompt": "Qual palavra rima com 'gato'?",
      "alternatives": [
        { "text": "Pato", "isCorrect": true },
        { "text": "Cadeira", "isCorrect": false }
      ]
    }
  ]
}
```

O array `tasks` está no formato `TaskInput`, pronto para (após edição opcional)
ser enviado ao endpoint de salvamento.

**Erros**

| Status | Body | Quando ocorre |
|---|---|---|
| `400 Bad Request` | `{ "message": "INVALID_QUANTITY" }` | `quantity` fora do intervalo 1–15 |
| `400 Bad Request` | `{ "message": "Bad Request", "errors": [...] }` | Falha de validação do body |
| `500 Internal Server Error` | `{ "message": "AI_GENERATION_FAILED", "error": "..." }` | Falha na chamada ao provedor de IA |
| `500 Internal Server Error` | `{ "message": "AI_INVALID_OUTPUT", "error": "..." }` | A IA retornou conteúdo não parseável / sem atividades válidas |

---

### 2. Upload de mídia de atividade

```
POST /task/upload-media
```

Sobe **um** arquivo (imagem ou áudio) e devolve sua URL pública, para ser usada
em `imageFile`/`audioFile` de uma atividade `multipleChoiceWithMedia` no
`POST /task/batch`. Usado apenas no fluxo de criação manual — a IA não gera mídia.

**Requisição** — `multipart/form-data`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `file` | `arquivo` | ✅ | Imagem ou áudio (máx. 10 MB) |

**Resposta — 200 OK**

```json
{ "url": "https://<bucket>.s3.amazonaws.com/<chave>" }
```

**Erros**

| Status | Body | Quando ocorre |
|---|---|---|
| `400 Bad Request` | `{ "message": "FILE_REQUIRED" }` | Nenhum arquivo enviado no campo `file` |
| `400 Bad Request` | `{ "message": "THIS FILE IS TO LARGE" }` | Arquivo acima de 10 MB |

---

### 3. Salvar atividades em lote + criar grupo

```
POST /task/batch
```

Persiste todas as atividades recebidas e cria um `TaskGroup` referenciando-as.
Agnóstico à origem: o array pode conter atividades geradas pela IA, criadas na
mão, com ou sem mídia. As atividades são validadas **antes** de qualquer escrita.

**Body**

```json
{
  "name": "Grupo de leitura - Turma A",
  "category": "reading",
  "tasks": [
    {
      "category": "reading",
      "type": "multipleChoice",
      "prompt": "Qual palavra rima com 'gato'?",
      "alternatives": [
        { "text": "Pato", "isCorrect": true },
        { "text": "Cadeira", "isCorrect": false }
      ]
    },
    {
      "category": "reading",
      "type": "multipleChoiceWithMedia",
      "prompt": "Que animal aparece na imagem?",
      "alternatives": [
        { "text": "Gato", "isCorrect": true },
        { "text": "Cachorro", "isCorrect": false }
      ],
      "imageFile": "https://cdn.exemplo.com/gato.png"
    }
  ]
}
```

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `name` | `string` (mín. 1) | ✅ | Nome do grupo de atividades |
| `category` | `TaskCategory` | ✅ | Categoria do grupo |
| `tasks` | `TaskInput[]` (mín. 1) | ✅ | Atividades a persistir |

**Resposta — 201 Created**

```json
{
  "taskGroup": {
    "id": "b1c2d3e4-...",
    "name": "Grupo de leitura - Turma A",
    "category": "reading",
    "educatorId": "a1b2c3d4-...",
    "tasksIds": ["t1-uuid", "t2-uuid"]
  },
  "taskIds": ["t1-uuid", "t2-uuid"]
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `taskGroup.id` | `string (uuid)` | ID do grupo criado |
| `taskGroup.name` | `string` | Nome do grupo |
| `taskGroup.category` | `TaskCategory` | Categoria do grupo |
| `taskGroup.educatorId` | `string (uuid)` | Educador dono (do token) |
| `taskGroup.tasksIds` | `string[]` | IDs das atividades no grupo |
| `taskIds` | `string[]` | IDs das atividades criadas (idêntico a `tasksIds`) |

**Erros**

| Status | Body | Quando ocorre |
|---|---|---|
| `400 Bad Request` | `{ "message": "Bad Request", "errors": [...] }` | Falha de validação do body (ex.: `tasks` vazio) |
| `400 Bad Request` | `{ "message": "INVALID_TASK_DATA" }` | Alguma atividade viola as regras de domínio (nº de alternativas, correta única, regras de mídia) |
| `400 Bad Request` | `{ "message": "EMPTY_TASK_LIST" }` | Lista de atividades vazia |
| `404 Not Found` | `{ "message": "EDUCATOR_NOT_FOUND" }` | Educador do token não encontrado |

---

## Respostas de erro comuns

| Status | Body | Quando ocorre |
|---|---|---|
| `400 Bad Request` | `{ "message": "..." }` ou `{ "message": "...", "errors": [...] }` | Validação de entrada ou regra de negócio |
| `401 Unauthorized` | `{ "message": "Missing or invalid token" }` | Token ausente, inválido ou expirado |
| `404 Not Found` | `{ "message": "..." }` | Recurso não encontrado |
| `500 Internal Server Error` | `{ "message": "...", "error": "..." }` | Erro inesperado ou falha de dependência externa (IA) |

---

## Exemplo completo (fetch)

```ts
const BASE_URL = 'https://labirinto-do-saber.vercel.app'
const token = '<bearer-token>'
const authHeaders = { Authorization: `Bearer ${token}` }

// 1. Gerar atividades com IA (não persiste)
const generated = await fetch(`${BASE_URL}/ai-task/generate`, {
  method: 'POST',
  headers: { ...authHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    targetAudience: 'Criança de 7 anos com dislexia',
    instructions: 'Atividades curtas de rima',
    quantity: 5,
    category: 'reading',
  }),
}).then(r => r.json())

// (opcional) O profissional revisa/edita generated.tasks e pode adicionar
// atividades manuais. Para uma atividade manual com imagem:
const form = new FormData()
form.append('file', fileInput.files[0])
const { url } = await fetch(`${BASE_URL}/task/upload-media`, {
  method: 'POST',
  headers: authHeaders, // não defina Content-Type: o browser cuida do boundary
  body: form,
}).then(r => r.json())

const manualTask = {
  category: 'reading',
  type: 'multipleChoiceWithMedia',
  prompt: 'Que animal aparece na imagem?',
  alternatives: [
    { text: 'Gato', isCorrect: true },
    { text: 'Cachorro', isCorrect: false },
  ],
  imageFile: url,
}

// 2. Salvar tudo em um grupo
const result = await fetch(`${BASE_URL}/task/batch`, {
  method: 'POST',
  headers: { ...authHeaders, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Grupo de leitura - Turma A',
    category: 'reading',
    tasks: [...generated.tasks, manualTask],
  }),
}).then(r => r.json())

console.log(result.taskGroup.id, result.taskIds)
```
