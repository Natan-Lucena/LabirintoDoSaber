import z from "zod";
import { Gender } from "../../../../domain/entities/student";
import { guardianFields } from "./guardian-fields";

export const updateStudentSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100).optional(),
  age: z.number().min(1).max(50).optional(),
  gender: z.nativeEnum(Gender).optional(),
  zipcode: z.string().min(5).max(10).optional(),
  road: z.string().min(1).max(100).optional(),
  housenumber: z.string().min(1).max(10).optional(),
  phonenumber: z.string().min(7).max(15).optional(),
  learningTopics: z.array(z.string().min(1).max(50)).min(1).optional(),
  ...guardianFields,
});
