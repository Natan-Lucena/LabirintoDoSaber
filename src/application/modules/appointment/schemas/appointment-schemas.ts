import { z } from "zod";
import { MAX_APPOINTMENT_DURATION_MINUTES } from "../../../../domain/entities/appointment";
import {
  MAX_SERIES_OCCURRENCES,
  MIN_SERIES_OCCURRENCES,
} from "../../../../domain/entities/appointment-series";
import { dateOnlySchema, uuidSchema } from "../../plan/schemas/plan-fields";

const appointmentTypeSchema = z.string().min(1).max(50);
const durationMinutesSchema = z.number().int().min(15).max(MAX_APPOINTMENT_DURATION_MINUTES);

export const createAppointmentSchema = z.object({
  studentId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  observation: z.string().optional(),
  type: appointmentTypeSchema.optional(),
  durationMinutes: durationMinutesSchema.optional(),
});

export const updateAppointmentSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
  observation: z.string().nullable().optional(),
  type: appointmentTypeSchema.optional(),
  durationMinutes: durationMinutesSchema.optional(),
  status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]).optional(),
});

// Período da agenda em dias de São Paulo (AAAA-MM-DD), os dois inclusivos.
// Com studentId, os atendimentos do aluno de qualquer educador (EQ-11).
export const listAppointmentsQuerySchema = z.object({
  studentId: z.string().uuid().optional(),
  from: dateOnlySchema.optional(),
  to: dateOnlySchema.optional(),
});

// RC-01 a RC-03. O limite de 6 meses (13 quinzenais) é regra da série.
export const createAppointmentSeriesSchema = z.object({
  studentId: uuidSchema,
  scheduledAt: z.string().datetime(),
  frequency: z.enum(["WEEKLY", "BIWEEKLY"]),
  occurrences: z.number().int().min(MIN_SERIES_OCCURRENCES).max(MAX_SERIES_OCCURRENCES),
  type: appointmentTypeSchema.optional(),
  durationMinutes: durationMinutesSchema.optional(),
  observation: z.string().optional(),
});

// RC-05: de scheduledAt só a hora de São Paulo é usada. null em observation apaga.
export const updateAppointmentSeriesSchema = z
  .object({
    fromAppointmentId: uuidSchema,
    scheduledAt: z.string().datetime().optional(),
    durationMinutes: durationMinutesSchema.optional(),
    type: appointmentTypeSchema.optional(),
    observation: z.string().nullable().optional(),
  })
  .refine(
    (body) =>
      body.scheduledAt !== undefined ||
      body.durationMinutes !== undefined ||
      body.type !== undefined ||
      body.observation !== undefined,
    "Informe ao menos um de scheduledAt, durationMinutes, type ou observation"
  );

export const cancelAppointmentSeriesSchema = z.object({
  fromAppointmentId: uuidSchema,
});
