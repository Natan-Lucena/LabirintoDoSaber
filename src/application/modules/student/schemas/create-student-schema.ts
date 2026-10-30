import z from "zod";
import { Gender } from "../../../../domain/entities/student";
import { guardianFields } from "./guardian-fields";
import { learningTopicsField } from "./learning-topics-field";

export const createStudentSchema = z.object({
  name: z.string().min(1).max(100),
  age: z.number().min(1).max(50),
  gender: z.nativeEnum(Gender),
  zipcode: z.string().min(5).max(10),
  road: z.string().min(1).max(100),
  housenumber: z.string().min(1).max(10),
  phonenumber: z.string().min(7).max(15),
  learningTopics: learningTopicsField,
  ...guardianFields,
});
