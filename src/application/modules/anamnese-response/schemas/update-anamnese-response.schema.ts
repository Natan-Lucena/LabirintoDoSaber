import { submitAnamneseResponseSchema } from "./submit-anamnese-response.schema";

export const updateAnamneseResponseSchema = submitAnamneseResponseSchema.pick({
  answers: true,
});
