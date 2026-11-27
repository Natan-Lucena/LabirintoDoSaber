import z from "zod";
import {
  isMultipleChoiceType,
  TASK_SKILLS_MAX,
  TASK_THEME_MAX,
  TaskCategory,
  TaskTone,
  TaskType,
} from "../../../../domain/entities/task";

export const alternativeSchema = z.object({
  text: z.string().min(1),
  isCorrect: z.boolean(),
});

export const skillsSchema = z.array(z.string().trim().min(1)).max(TASK_SKILLS_MAX);
export const themeSchema = z.string().trim().max(TASK_THEME_MAX);

// Atividade de múltipla escolha (lote e geração por IA).
export const taskFieldsSchema = z.object({
  category: z.nativeEnum(TaskCategory),
  type: z
    .nativeEnum(TaskType)
    .refine(isMultipleChoiceType, "Somente multipleChoice ou multipleChoiceWithMedia"),
  prompt: z.string().min(1),
  alternatives: z.array(alternativeSchema).min(2),
});

// `content` é validado pela entidade (400 INVALID_CONTENT com o campo).
export const createTaskSchema = z
  .object({
    category: z.nativeEnum(TaskCategory),
    type: z.nativeEnum(TaskType),
    prompt: z.string().trim().min(1),
    alternatives: z.array(alternativeSchema).optional(),
    content: z.unknown().optional(),
    skills: skillsSchema.optional(),
    theme: themeSchema.optional(),
    tone: z.nativeEnum(TaskTone).optional(),
  })
  .superRefine((data, ctx) => {
    if (isMultipleChoiceType(data.type) && (data.alternatives?.length ?? 0) < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["alternatives"],
        message: "Múltipla escolha precisa de pelo menos 2 alternativas",
      });
    }
  });
