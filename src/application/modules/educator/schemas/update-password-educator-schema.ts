import z from "zod";

export const updatePasswordEducatorSchema = z.object({
  email: z.string().email(),
  newPassword: z.string().min(6).max(100),
});
