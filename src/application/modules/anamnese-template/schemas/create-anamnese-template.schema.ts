import z from "zod";
import { AnamneseQuestionType } from "../../../../domain/entities/anamnese-template";

const questionOptionSchema = z.object({
  text: z.string().min(1),
});

const questionSchema = z
  .object({
    text: z.string().min(1),
    type: z.nativeEnum(AnamneseQuestionType),
    required: z.boolean(),
    options: z.array(questionOptionSchema).optional(),
  })
  .refine(
    (q) => {
      const requiresOptions =
        q.type === AnamneseQuestionType.MultipleChoice ||
        q.type === AnamneseQuestionType.Checkbox;
      return requiresOptions ? (q.options?.length ?? 0) >= 2 : true;
    },
    { message: "MultipleChoice and Checkbox questions require at least 2 options" }
  );

export const createAnamneseTemplateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  questions: z.array(questionSchema),
});
