# POST /task-notebook-session/observation

Adiciona uma observação textual a uma sessão de caderno de tarefas **já finalizada**.

---

## Autenticação

Requer token JWT de educador no header `Authorization`.

```
Authorization: Bearer <token>
```

---

## Request

**Method:** `POST`  
**URL:** `/task-notebook-session/observation`  
**Content-Type:** `application/json`

### Body

| Campo         | Tipo     | Obrigatório | Descrição                          |
|---------------|----------|-------------|------------------------------------|
| `sessionId`   | `string` (UUID) | Sim | ID da sessão a ser observada  |
| `observation` | `string` | Sim (min 1 char) | Texto da observação           |

### Exemplo

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "observation": "Aluno demonstrou dificuldade nas questões de interpretação de texto."
}
```

---

## Responses

### 200 OK — Observação registrada com sucesso

Retorna a sessão atualizada com o campo `observation` preenchido.

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "studentId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "educatorId": "f9e8d7c6-b5a4-3210-fedc-ba9876543210",
  "name": "Sessão de Leitura — Turma A",
  "startedAt": "2026-05-04T10:00:00.000Z",
  "finishedAt": "2026-05-04T10:45:00.000Z",
  "observation": "Aluno demonstrou dificuldade nas questões de interpretação de texto.",
  "answers": [...]
}
```

### 400 Bad Request — Validação do body falhou

Campos ausentes ou com formato inválido.

```json
{
  "errors": [
    { "field": "sessionId", "message": "Invalid uuid" }
  ]
}
```

### 400 Bad Request — Sessão ainda não finalizada

```json
{
  "message": "SESSION_NOT_FINISHED"
}
```

A observação só pode ser adicionada após chamar `POST /task-notebook-session/finish`.

### 404 Not Found — Sessão não encontrada

```json
{
  "message": "SESSION_NOT_FOUND"
}
```

### 401 Unauthorized — Token ausente ou inválido

```json
{
  "message": "Missing or invalid token"
}
```

---

## Fluxo de uso

```
1. POST /task-notebook-session/start       → cria a sessão
2. POST /task-notebook-session/answer      → responde as tarefas
3. POST /task-notebook-session/finish      → finaliza a sessão
4. POST /task-notebook-session/observation → adiciona observação (este endpoint)
```

A observação pode ser atualizada chamando o endpoint novamente com um novo texto — o valor anterior é sobrescrito.

---

## Regras de negócio

- A sessão deve existir e estar finalizada (`finishedAt` preenchido).
- `observation` não pode ser string vazia.
- Não há limite máximo de caracteres definido no schema — aplique restrições no front-end se necessário.
