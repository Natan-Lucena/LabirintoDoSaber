import { z } from "zod";
import { Uuid } from "@wave-telecom/framework/core";
import { isValidDateOnly } from "../../../../domain/utils/date-only";

export const dateOnlySchema = z
  .string()
  .refine(isValidDateOnly, "Data deve ser válida no formato AAAA-MM-DD");

export const uuidSchema = z
  .string()
  .refine((value) => Uuid.isValid(value), "Uuid inválido");
