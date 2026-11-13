import z from "zod";

export const generateAuthTokenSchema = z.object({
  email: z.string().email(),
});
