import z from "zod";
import { Gender } from "../../../../domain/entities/student";

export const createStudentSchema = z.object({
  name: z.string().min(1).max(100),
  age: z.number().min(1).max(50),
  gender: z.nativeEnum(Gender),
  learningTopics: z.array(z.string().min(1).max(50)).min(1),
});
