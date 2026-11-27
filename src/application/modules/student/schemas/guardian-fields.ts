import z from "zod";

// As rotas de aluno são multipart: campo deixado em branco no formulário
// chega como "" e é tratado como ausente.

// PP-05, só na edição: o texto "null" (multipart) ou null (JSON) apaga o
// valor; vazio continua ausente, que mantém o valor atual.
const clearableText = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (value) => (value === "" ? undefined : value === "null" ? null : value),
    schema.nullable().optional()
  );

const guardianSchemas = {
  guardianName: z.string().min(1).max(100),
  guardianPhone: z.string().regex(/^\d{7,15}$/),
  guardianRelationship: z.string().min(1).max(50),
};

// No cadastro não há o que apagar: "null" e null valem como ausentes.
const createText = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (value) => (value === "" || value === "null" || value === null ? undefined : value),
    schema.optional()
  );

export const guardianFields = {
  guardianName: createText(guardianSchemas.guardianName),
  guardianPhone: createText(guardianSchemas.guardianPhone),
  guardianRelationship: createText(guardianSchemas.guardianRelationship),
};

export const clearableGuardianFields = {
  guardianName: clearableText(guardianSchemas.guardianName),
  guardianPhone: clearableText(guardianSchemas.guardianPhone),
  guardianRelationship: clearableText(guardianSchemas.guardianRelationship),
};
