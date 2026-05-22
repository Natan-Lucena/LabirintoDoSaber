# Anamnese — Upload de Arquivos

## Contexto

O endpoint de submissão de respostas (`POST /anamnese/templates/:templateId/responses`)
espera que respostas do tipo **FileUpload** contenham uma **URL pública** apontando para o
arquivo, não o arquivo em si.

Para obter essa URL, foi adicionado um endpoint dedicado de upload que deve ser chamado
**antes** de submeter a resposta.

---

## Novo endpoint: Upload de arquivo

```
POST /anamnese/responses/upload-file
```

### Autenticação

Bearer token JWT no header `Authorization` (mesmo esquema dos demais endpoints).

### Request

`Content-Type: multipart/form-data`

| Campo | Tipo   | Obrigatório | Descrição                        |
|-------|--------|-------------|----------------------------------|
| file  | File   | sim         | Arquivo a ser armazenado (máx. 10 MB) |

### Response — 200 OK

```json
{
  "url": "https://s3.amazonaws.com/bucket/upload-key.pdf"
}
```

### Erros possíveis

| Status | Código           | Descrição                        |
|--------|------------------|----------------------------------|
| 400    | `FILE_REQUIRED`  | Nenhum arquivo enviado na requisição |
| 401    | —                | Token ausente ou inválido        |
| 500    | —                | Falha ao fazer upload para o storage |

---

## Fluxo completo para questões do tipo FileUpload

```
1. Faça upload do arquivo:
   POST /anamnese/responses/upload-file
   Body: multipart/form-data { file: <arquivo> }
   → Recebe: { "url": "https://..." }

2. Use a URL retornada ao submeter a resposta:
   POST /anamnese/templates/:templateId/responses
   Body: {
     "studentId": "<uuid>",
     "answers": [
       {
         "questionId": "<uuid-da-questão-fileupload>",
         "fileUrl": "https://..."   ← URL obtida no passo 1
       }
     ]
   }
```

---

## Schema de resposta (sem alterações)

O campo `fileUrl` no array `answers` permanece como `string (URL)`:

```json
{
  "studentId": "string (uuid)",
  "answers": [
    {
      "questionId": "string (uuid)",
      "textValue": "string?",
      "selectedOptionId": "string (uuid)?",
      "selectedOptionIds": ["string (uuid)"]?,
      "fileUrl": "string (url)?"
    }
  ]
}
```

---

## O que mudou no back end

| Arquivo                                                                | Mudança                                                             |
|------------------------------------------------------------------------|---------------------------------------------------------------------|
| `use-cases/upload-anamnese-file/upload-anamnese-file-use-case.ts`      | **Novo** — use case que chama `FileStorage.saveFile()` e retorna a URL |
| `use-cases/upload-anamnese-file/upload-anamnese-file-controller.ts`    | **Novo** — controller que valida presença do arquivo e chama o use case |
| `routes/index.ts` (anamnese-response)                                  | **Atualizado** — rota `POST /anamnese/responses/upload-file` registrada com middleware multer (10 MB) |

A implementação depende da **abstração** `FileStorage` (interface em
`src/application/services/file-storage.ts`), não da implementação AWS S3 diretamente.
