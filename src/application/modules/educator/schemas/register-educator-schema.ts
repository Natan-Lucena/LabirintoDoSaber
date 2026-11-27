import z from "zod";

export const registerEducatorSchema = z.object({
  name: z.string().min(3).max(100),
  email: z.string().email(),
  password: z.string().min(6).max(100),
  // Convite da clínica (EQ-06): cria a conta já como membro.
  inviteCode: z.string().trim().min(1).max(32).optional(),
});
