import z from "zod";

// As rotas de aluno são multipart: campo deixado em branco no formulário
// chega como "" e deve ser tratado como ausente.
const optionalText = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema.optional());

export const guardianFields = {
  guardianName: optionalText(z.string().min(1).max(100)),
  guardianPhone: optionalText(z.string().regex(/^\d{7,15}$/)),
  guardianRelationship: optionalText(z.string().min(1).max(50)),
};
