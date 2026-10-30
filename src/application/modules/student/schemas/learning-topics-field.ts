import z from "zod";

// As rotas de aluno são multipart: a lista chega como texto. Aceita um array
// JSON (`["leitura","escrita"]`) ou, se o texto não for JSON, valores
// separados por vírgula (`leitura, escrita`), com espaços removidos.
const parseLearningTopics = (value: unknown) => {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value.split(",").map((item) => item.trim());
  }
};

export const learningTopicsField = z.preprocess(
  parseLearningTopics,
  z.array(z.string().min(1).max(50)).min(1)
);
