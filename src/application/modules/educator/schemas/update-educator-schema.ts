import { z } from "zod";

export const updateEducatorSchema = z.object({
  email: z.string().email(),
  newName: z.string().min(3).max(100).optional(),
  newContact: z.string().min(3).max(100).optional(),
  newProfession: z.string().min(3).max(100).optional(),
});
