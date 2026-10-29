import { z } from "zod";
import { Uuid } from "@wave-telecom/framework/core";

export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato AAAA-MM-DD");

export const uuidSchema = z
  .string()
  .refine((value) => Uuid.isValid(value), "Uuid inválido");
