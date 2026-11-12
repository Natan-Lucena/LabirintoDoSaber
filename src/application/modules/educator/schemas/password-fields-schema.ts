import z from "zod";

// Código de recuperação de senha enviado por e-mail: 6 dígitos.
export const recoveryCodeSchema = z
  .string()
  .regex(/^\d{6}$/, "Token must have 6 digits");

export const newPasswordSchema = z.string().min(6).max(100);
