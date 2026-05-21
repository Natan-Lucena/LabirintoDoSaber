# Planejamento — Entidade Anamnese

## Visão Geral

O fluxo tem duas partes bem separadas: **modelagem** (o profissional cria o template) e **resposta** (o profissional preenche com o aluno em uma única request). São dois agregados distintos.

---

## 1. Entidades de Domínio

### `AnamneseTemplate`
O modelo criado pelo profissional. Contém as questões mas nenhuma resposta.

| Campo | Tipo | Observação |
|-------|------|------------|
| `id` | `Uuid` | |
| `educatorId` | `Uuid` | |
| `title` | `string` | |
| `description` | `string?` | opcional |
| `questions` | `AnamneseQuestion[]` | value objects embutidos |
| `createdAt` | `Date` | |

---

### `AnamneseQuestion` _(value object embutido em `AnamneseTemplate`)_

| Campo | Tipo | Observação |
|-------|------|------------|
| `id` | `Uuid` | |
| `text` | `string` | enunciado da questão |
| `type` | `AnamneseQuestionType` | enum |
| `required` | `boolean` | define se a resposta é obrigatória |
| `order` | `number` | preserva a ordem de exibição |
| `options` | `AnamneseQuestionOption[]?` | apenas para `MultipleChoice` e `Checkbox` |

---

### `AnamneseQuestionOption` _(value object embutido em `AnamneseQuestion`)_

| Campo | Tipo |
|-------|------|
| `id` | `Uuid` |
| `text` | `string` |

---

### `AnamneseQuestionType` _(enum)_

| Valor | Comportamento |
|-------|---------------|
| `Descriptive` | Campo de texto livre |
| `MultipleChoice` | Exatamente 1 opção selecionada |
| `Checkbox` | 1 ou mais opções selecionadas |
| `FileUpload` | URL de arquivo (laudos, relatórios, etc.) |

---

### `AnamneseResponse`
O formulário preenchido pelo profissional com o aluno. Persiste todas as respostas de uma só vez.

| Campo | Tipo | Observação |
|-------|------|------------|
| `id` | `Uuid` | |
| `templateId` | `Uuid` | referência ao template respondido |
| `educatorId` | `Uuid` | |
| `studentId` | `Uuid` | |
| `answeredAt` | `Date` | |
| `answers` | `AnamneseAnswer[]` | value objects embutidos |

---

### `AnamneseAnswer` _(value object embutido em `AnamneseResponse`)_

| Campo | Tipo | Observação |
|-------|------|------------|
| `questionId` | `Uuid` | |
| `questionType` | `AnamneseQuestionType` | denormalizado para leitura independente do template |
| `textValue` | `string?` | usado em `Descriptive` |
| `selectedOptionId` | `string?` | usado em `MultipleChoice` (apenas 1) |
| `selectedOptionIds` | `string[]?` | usado em `Checkbox` (1 ou mais) |
| `fileUrl` | `string?` | usado em `FileUpload` |

**Regras de validação ao criar `AnamneseResponse`:**
- Questões com `required: true` no template devem ter resposta
- `MultipleChoice` → apenas `selectedOptionId` preenchido; deve ser um dos IDs de opções do template
- `Checkbox` → apenas `selectedOptionIds` preenchido; todos devem ser IDs de opções válidos do template
- `Descriptive` → apenas `textValue` preenchido
- `FileUpload` → apenas `fileUrl` preenchido

---

## 2. Mudanças no Prisma

```prisma
// ─── Novo enum ───────────────────────────────────────────────────────────────
enum AnamneseQuestionType {
  Descriptive
  MultipleChoice
  Checkbox
  FileUpload
}

// ─── Value objects embutidos ─────────────────────────────────────────────────
type AnamneseQuestionOption {
  id   String
  text String
}

type AnamneseQuestion {
  id       String
  text     String
  type     AnamneseQuestionType
  required Boolean
  order    Int
  options  AnamneseQuestionOption[]
}

type AnamneseAnswer {
  questionId        String
  questionType      AnamneseQuestionType
  textValue         String?
  selectedOptionId  String?
  selectedOptionIds String[]
  fileUrl           String?
}

// ─── Novos models ─────────────────────────────────────────────────────────────
model AnamneseTemplate {
  id          String             @id @map("_id")
  educatorId  String
  title       String
  description String?
  questions   AnamneseQuestion[]
  createdAt   DateTime           @default(now())
}

model AnamneseResponse {
  id         String           @id @map("_id")
  templateId String
  educatorId String
  studentId  String
  answeredAt DateTime         @default(now())
  answers    AnamneseAnswer[]
}
```

> Por ser MongoDB, os tipos embutidos (`type`) são documentos aninhados — não há tabelas de junção. `AnamneseTemplate` e `AnamneseResponse` são documentos independentes, relacionados apenas via `templateId` (sem `@relation` explícita, consistente com o padrão já adotado em `TaskNotebookSession`).

---

## 3. Endpoints

### Módulo `anamnese-template`

| Método | Rota | Use Case | Descrição |
|--------|------|----------|-----------|
| `POST` | `/anamnese/templates` | `CreateAnamneseTemplate` | Cria um novo template com suas questões |
| `GET` | `/anamnese/templates` | `ListAnamneseTemplatesByEducator` | Lista todos os templates do profissional autenticado |
| `GET` | `/anamnese/templates/:templateId` | `GetAnamneseTemplate` | Retorna o template completo (usado antes de responder) |
| `PUT` | `/anamnese/templates/:templateId` | `UpdateAnamneseTemplate` | Atualiza título, descrição e/ou questões |
| `DELETE` | `/anamnese/templates/:templateId` | `DeleteAnamneseTemplate` | Remove o template |

### Módulo `anamnese-response`

| Método | Rota | Use Case | Descrição |
|--------|------|----------|-----------|
| `POST` | `/anamnese/templates/:templateId/responses` | `SubmitAnamneseResponse` | Envia todas as respostas de uma vez para um aluno |
| `GET` | `/anamnese/responses/student/:studentId` | `ListAnamneseResponsesByStudent` | Lista histórico de respostas de um aluno |
| `GET` | `/anamnese/responses/:responseId` | `GetAnamneseResponse` | Retorna uma resposta completa |

---

## 4. Observações de Design

**Por que dois modelos separados e não `responses` embutido no template?**
Trafegar o template já com todas as respostas embutidas seria muito pesado. Separando, o `GET /templates/:id` retorna apenas a estrutura leve do formulário, e as respostas são buscadas sob demanda.

**Denormalização de `questionType` em `AnamneseAnswer`**
Cada resposta carrega seu próprio tipo, tornando a leitura autônoma — sem precisar buscar o template para interpretar o que foi respondido. Funciona bem mesmo se o template eventualmente for deletado.

**Fluxo de resposta**
O front faz `GET /anamnese/templates/:templateId` para montar o formulário e, após o profissional preencher, dispara `POST /anamnese/templates/:templateId/responses` com todas as respostas — uma única request.

**Edição de templates com respostas vinculadas**
Não é permitido. Uma vez que existam respostas vinculadas ao template, ele se torna imutável para preservar o rastreio histórico. O `UpdateAnamneseTemplate` deve retornar erro caso existam `AnamneseResponse` com aquele `templateId`.
