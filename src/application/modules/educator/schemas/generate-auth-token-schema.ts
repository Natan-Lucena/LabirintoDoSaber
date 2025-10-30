import z from "zod";

export const generateAuthTokenSchema = z.object({
  educatorEmail: z.string().email(),
});
