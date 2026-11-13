import z from "zod";
import { newPasswordSchema, recoveryCodeSchema } from "./password-fields-schema";

export const updatePasswordEducatorSchema = z.object({
  email: z.string().email(),
  token: recoveryCodeSchema,
  newPassword: newPasswordSchema,
});
