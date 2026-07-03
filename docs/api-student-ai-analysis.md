# API — Análise do Aluno por IA

**Base URL:** `https://labirinto-do-saber.vercel.app`

Endpoint que gera uma **análise psicopedagógica textual e extensa** do aluno
usando IA (Gemini). É acionado pelo toggle de "Análise por IA" no fluxo de
geração do relatório. Não persiste nada — devolve o texto para o cliente.

Exige autenticação via Bearer token.

---

## Autenticação

```
Authorization: Bearer <token>
```

---

## Endpoint

```
GET /task-notebook-session/analysis/student/:studentId/ai
```

Reúne o máximo de informação do aluno (perfil, métricas de desempenho, histórico
de sessões e, opcionalmente, a anamnese) e pede à IA uma análise completa:
visão geral, pontos fortes, fraquezas, observações de padrões, pontos de melhoria,
guia de intervenção e considerações finais.

### Parâmetro de rota

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `studentId` | `string (uuid)` | ID do aluno |

### Query params

Definem o período analisado (as mesmas regras do endpoint de métricas) e,
opcionalmente, incluem os dados da anamnese.

| Param | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `limit` | `integer > 0` | ❌ | Considera as N sessões mais recentes |
| `startDate` | `string (ISO 8601, com offset)` | ❌ | Início do período |
| `endDate` | `string (ISO 8601, com offset)` | ❌ | Fim do período |
| `templateId` | `string (uuid)` | ❌ | Se enviado, inclui na análise as respostas de anamnese do aluno para esse template |

> **Regra:** `limit` **não** pode ser combinado com `startDate`/`endDate`. Sem
> nenhum desses, considera todas as sessões do aluno.

**Dados enviados à IA** (montados no servidor):
- **Perfil:** nome, idade, gênero e temas/objetivos de aprendizagem.
- **Métricas:** acerto geral e por categoria (`reading`, `writing`, `vocabulary`, `comprehension`).
- **Sessões:** por sessão — período, desempenho, tempo médio por questão,
  observação do educador e, por resposta, o enunciado da atividade, a categoria,
  se acertou e o tempo gasto.
- **Anamnese** (se `templateId`): perguntas e respostas já convertidas em texto.

### Resposta — 200 OK

```json
{
  "analysis": "## Visão Geral\n\nJoão, 8 anos, ...\n\n## Maiores Acertos e Pontos Fortes\n...\n\n## Guia de Intervenção\n..."
}
```

| Campo | Tipo | Descrição |
|---|---|---|
| `analysis` | `string` | Relatório em **markdown**, propositalmente extenso, com as seções: Visão Geral, Maiores Acertos e Pontos Fortes, Principais Fraquezas e Dificuldades, Observações de Padrões, Pontos de Melhoria, Guia de Intervenção e Considerações Finais |

### Erros

| Status | Body | Quando ocorre |
|---|---|---|
| `400 Bad Request` | `{ "message": "Bad Request", "errors": [...] }` | `studentId` inválido, datas inválidas ou `limit` combinado com `startDate`/`endDate` |
| `401 Unauthorized` | `{ "message": "Missing or invalid token" }` | Token ausente, inválido ou expirado |
| `404 Not Found` | `{ "message": "STUDENT_NOT_FOUND" }` | Aluno não encontrado |
| `500 Internal Server Error` | `{ "message": "AI_ANALYSIS_FAILED", "error": "..." }` | Falha na chamada à IA (inclui indisponibilidade temporária do modelo, ex.: HTTP 503) |

---

## Exemplos (fetch)

```ts
const BASE_URL = 'https://labirinto-do-saber.vercel.app'
const token = '<bearer-token>'
const authHeaders = { Authorization: `Bearer ${token}` }

// Análise das 10 sessões mais recentes
const byLimit = await fetch(
  `${BASE_URL}/task-notebook-session/analysis/student/${studentId}/ai?limit=10`,
  { headers: authHeaders }
).then(r => r.json())

console.log(byLimit.analysis)

// Análise de um período, incluindo os dados da anamnese
const params = new URLSearchParams({
  startDate: '2026-06-01T00:00:00-03:00',
  endDate: '2026-06-30T23:59:59-03:00',
  templateId: '<template-uuid>',
})
const byPeriod = await fetch(
  `${BASE_URL}/task-notebook-session/analysis/student/${studentId}/ai?${params}`,
  { headers: authHeaders }
).then(r => r.json())

console.log(byPeriod.analysis)
```

---

## Relação com os outros endpoints de análise

Este endpoint **complementa** os já existentes; não os substitui:

| Endpoint | Papel |
|---|---|
| `GET /analysis/student/:studentId` | Métricas/sessões numéricas do aluno |
| `POST /analysis/student/:studentId/snapshot` | Persiste um snapshot do relatório |
| `GET /analysis/student/:studentId/history` | Histórico de snapshots |
| `GET /analysis/student/:studentId/ai` | **Análise textual gerada por IA** (este documento) |
