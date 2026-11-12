import z from "zod";
import { recoveryCodeSchema } from "./password-fields-schema";

export const verifyTokenSchema = z.object({
  email: z.string().email(),
  token: recoveryCodeSchema,
});
