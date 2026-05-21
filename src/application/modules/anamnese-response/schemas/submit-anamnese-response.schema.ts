import z from "zod";

const answerSchema = z.object({
  questionId: z.string().uuid(),
  textValue: z.string().min(1).optional(),
  selectedOptionId: z.string().uuid().optional(),
  selectedOptionIds: z.array(z.string().uuid()).optional(),
  fileUrl: z.string().url().optional(),
});

export const submitAnamneseResponseSchema = z.object({
  studentId: z.string().uuid(),
  answers: z.array(answerSchema),
});
