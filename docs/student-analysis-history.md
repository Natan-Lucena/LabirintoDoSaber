# Student Analysis — Rotas de Análise e Histórico

Documentação das rotas de análise de desempenho de estudantes.

---

## Visão geral

O fluxo é separado em dois comportamentos distintos:

| Intenção                                    | Rota                                                    |
|---------------------------------------------|---------------------------------------------------------|
| Consultar análise em tempo real (sem salvar) | `GET /analysis/student/:studentId`                      |
| Salvar snapshot do resultado no histórico    | `POST /analysis/student/:studentId/snapshot`            |
| Listar histórico de snapshots salvos         | `GET /analysis/student/:studentId/history`              |

> O `GET` é idempotente e não causa efeitos colaterais no banco. O `POST /snapshot` é o ato explícito de persistir uma análise.

---

## Rotas

### `GET /task-notebook-session/analysis/student/:studentId`

Calcula e retorna a análise de desempenho do estudante. **Não persiste nada.**

#### Autenticação
Bearer token JWT obrigatório (`Authorization: Bearer <token>`).

#### Parâmetros de rota

| Parâmetro   | Tipo   | Obrigatório | Descrição       |
|-------------|--------|-------------|-----------------|
| `studentId` | `UUID` | Sim         | ID do estudante |

#### Query parameters

| Parâmetro   | Tipo      | Obrigatório | Restrição                              | Descrição                                                            |
|-------------|-----------|-------------|----------------------------------------|----------------------------------------------------------------------|
| `startDate` | `string`  | Não         | Não pode ser combinado com `limit`     | Data inicial ISO 8601 com offset (ex: `2026-01-01T00:00:00-03:00`)  |
| `endDate`   | `string`  | Não         | Não pode ser combinado com `limit`     | Data final ISO 8601 com offset                                       |
| `limit`     | `integer` | Não         | Inteiro positivo; exclusivo com datas  | Considera apenas as N sessões mais recentes                          |

> Se nenhum filtro for informado, todas as sessões do estudante são consideradas.

#### Resposta de sucesso — `200 OK`

```json
{
  "categories": {
    "Reading":       { "category": "Reading",       "total": 10, "correct": 7, "accuracy": 0.7  },
    "Writing":       { "category": "Writing",       "total": 5,  "correct": 3, "accuracy": 0.6  },
    "Vocabulary":    { "category": "Vocabulary",    "total": 8,  "correct": 8, "accuracy": 1.0  },
    "Comprehension": { "category": "Comprehension", "total": 4,  "correct": 2, "accuracy": 0.5  }
  },
  "total": {
    "total": 27,
    "correct": 20,
    "accuracy": 0.7407407407407407
  },
  "sessions": [
    {
      "id": "uuid-da-sessao",
      "studentId": "uuid-do-estudante",
      "educatorId": "uuid-do-educador",
      "name": "Sessão de Leitura",
      "startedAt": "2026-05-01T10:00:00.000Z",
      "finishedAt": "2026-05-01T10:45:00.000Z",
      "answers": [
        {
          "taskId": "uuid-da-tarefa",
          "selectedAlternativeId": "uuid-da-alternativa",
          "isCorrect": true,
          "timeToAnswer": 30,
          "answeredAt": "2026-05-01T10:05:00.000Z"
        }
      ],
      "observation": "Bom desempenho na leitura."
    }
  ]
}
```

#### Respostas de erro

| Status | Condição                                    |
|--------|---------------------------------------------|
| `400`  | `studentId` inválido (não UUID)             |
| `400`  | `limit` combinado com `startDate`/`endDate` |
| `404`  | Estudante não encontrado                    |
| `401`  | Token ausente ou inválido                   |

---

### `POST /task-notebook-session/analysis/student/:studentId/snapshot`

Calcula a análise e **salva um snapshot** no histórico. Retorna o `StudentAnalysisReport` criado.

Use esta rota quando o educador quiser registrar explicitamente o resultado de uma análise para consulta futura.

#### Autenticação
Bearer token JWT obrigatório (`Authorization: Bearer <token>`).

#### Parâmetros de rota

| Parâmetro   | Tipo   | Obrigatório | Descrição       |
|-------------|--------|-------------|-----------------|
| `studentId` | `UUID` | Sim         | ID do estudante |

#### Query parameters

Mesmos do `GET` — `startDate`, `endDate`, `limit` com as mesmas restrições.

#### Resposta de sucesso — `200 OK`

Retorna o `StudentAnalysisReport` recém-criado.

```json
{
  "id": "uuid-do-snapshot",
  "studentId": "uuid-do-estudante",
  "generatedAt": "2026-05-08T14:30:00.000Z",
  "startDate": null,
  "endDate": null,
  "limit": null,
  "sessionIds": ["uuid-sessao-1", "uuid-sessao-2"],
  "categories": [
    { "category": "Reading",       "total": 10, "correct": 7, "accuracy": 0.7  },
    { "category": "Writing",       "total": 5,  "correct": 3, "accuracy": 0.6  },
    { "category": "Vocabulary",    "total": 8,  "correct": 8, "accuracy": 1.0  },
    { "category": "Comprehension", "total": 4,  "correct": 2, "accuracy": 0.5  }
  ],
  "totalQuestions": 27,
  "totalCorrect": 20,
  "accuracy": 0.7407407407407407
}
```

#### Respostas de erro

| Status | Condição                                    |
|--------|---------------------------------------------|
| `400`  | `studentId` inválido (não UUID)             |
| `400`  | `limit` combinado com `startDate`/`endDate` |
| `404`  | Estudante não encontrado                    |
| `401`  | Token ausente ou inválido                   |

---

### `GET /task-notebook-session/analysis/student/:studentId/history`

Retorna todos os snapshots salvos para o estudante, do mais recente ao mais antigo.

#### Autenticação
Bearer token JWT obrigatório (`Authorization: Bearer <token>`).

#### Parâmetros de rota

| Parâmetro   | Tipo   | Obrigatório | Descrição       |
|-------------|--------|-------------|-----------------|
| `studentId` | `UUID` | Sim         | ID do estudante |

#### Resposta de sucesso — `200 OK`

Array de `StudentAnalysisReport[]`. Retorna `[]` se nenhum snapshot foi salvo ainda.

```json
[
  {
    "id": "uuid-snapshot-2",
    "studentId": "uuid-do-estudante",
    "generatedAt": "2026-05-08T14:30:00.000Z",
    "startDate": null,
    "endDate": null,
    "limit": 5,
    "sessionIds": ["uuid-sessao-3", "uuid-sessao-4"],
    "categories": [
      { "category": "Reading",       "total": 5, "correct": 4, "accuracy": 0.8  },
      { "category": "Writing",       "total": 3, "correct": 2, "accuracy": 0.67 },
      { "category": "Vocabulary",    "total": 2, "correct": 2, "accuracy": 1.0  },
      { "category": "Comprehension", "total": 0, "correct": 0, "accuracy": 0.0  }
    ],
    "totalQuestions": 10,
    "totalCorrect": 8,
    "accuracy": 0.8
  },
  {
    "id": "uuid-snapshot-1",
    "studentId": "uuid-do-estudante",
    "generatedAt": "2026-05-01T09:00:00.000Z",
    "startDate": "2026-04-01T00:00:00.000Z",
    "endDate": "2026-04-30T23:59:59.000Z",
    "limit": null,
    "sessionIds": ["uuid-sessao-1", "uuid-sessao-2"],
    "categories": [
      { "category": "Reading",       "total": 10, "correct": 7, "accuracy": 0.7  },
      { "category": "Writing",       "total": 5,  "correct": 3, "accuracy": 0.6  },
      { "category": "Vocabulary",    "total": 8,  "correct": 8, "accuracy": 1.0  },
      { "category": "Comprehension", "total": 4,  "correct": 2, "accuracy": 0.5  }
    ],
    "totalQuestions": 27,
    "totalCorrect": 20,
    "accuracy": 0.7407407407407407
  }
]
```

#### Respostas de erro

| Status | Condição                        |
|--------|---------------------------------|
| `400`  | `studentId` inválido (não UUID) |
| `401`  | Token ausente ou inválido       |

---

## Tipos

### `StudentAnalysisResponse` (retorno do GET)

| Campo       | Tipo                                       | Descrição                                      |
|-------------|--------------------------------------------|------------------------------------------------|
| `categories`| `Record<TaskCategory, CategoryAccuracyResult>` | Resultado por categoria                    |
| `total`     | `{ total: number; correct: number; accuracy: number }` | Totais gerais               |
| `sessions`  | `TaskNotebookSession[]`                    | Sessões consideradas no cálculo                |

### `StudentAnalysisReport` (retorno do POST e do history)

| Campo           | Tipo                    | Nullable | Descrição                                        |
|-----------------|-------------------------|----------|--------------------------------------------------|
| `id`            | `string (UUID)`         | Não      | Identificador único do snapshot                  |
| `studentId`     | `string (UUID)`         | Não      | ID do estudante                                  |
| `generatedAt`   | `string (ISO 8601)`     | Não      | Timestamp de geração                             |
| `startDate`     | `string (ISO 8601)`     | Sim      | Filtro de data inicial usado                     |
| `endDate`       | `string (ISO 8601)`     | Sim      | Filtro de data final usado                       |
| `limit`         | `integer`               | Sim      | Filtro de limit usado                            |
| `sessionIds`    | `string[]`              | Não      | IDs das sessões consideradas no cálculo          |
| `categories`    | `CategoryAccuracyData[]`| Não      | Resultado por categoria (sempre 4 itens)         |
| `totalQuestions`| `integer`               | Não      | Total de questões respondidas                    |
| `totalCorrect`  | `integer`               | Não      | Total de acertos                                 |
| `accuracy`      | `float (0–1)`           | Não      | Acurácia geral (`totalCorrect / totalQuestions`) |

### `CategoryAccuracyData`

| Campo      | Tipo           | Descrição                                 |
|------------|----------------|-------------------------------------------|
| `category` | `TaskCategory` | Nome da categoria                         |
| `total`    | `integer`      | Questões respondidas nesta categoria      |
| `correct`  | `integer`      | Acertos nesta categoria                   |
| `accuracy` | `float (0–1)`  | Acurácia (`correct / total`, 0 se sem respostas) |

### `TaskCategory` (enum)

| Valor           |
|-----------------|
| `Reading`       |
| `Writing`       |
| `Vocabulary`    |
| `Comprehension` |
