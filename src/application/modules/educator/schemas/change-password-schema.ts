import z from "zod";
import { newPasswordSchema } from "./password-fields-schema";

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: newPasswordSchema,
});
