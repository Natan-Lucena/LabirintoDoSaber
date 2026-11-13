import { z } from "zod";

export const MAX_ANSWERS_PER_REQUEST = 200;

// Item fora da escala e valor fora das opções ficam com a entidade
// (400 ITEM_NOT_IN_SCALE, 400 INVALID_ANSWER_VALUE), não com o Zod.
export const saveScaleAnswersSchema = z.object({
  answers: z
    .array(
      z.object({
        itemId: z.string().min(1).max(100),
        value: z.number().finite(),
      })
    )
    .min(1)
    .max(MAX_ANSWERS_PER_REQUEST),
});
