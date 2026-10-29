import { z } from "zod";
import { MAX_APPOINTMENT_DURATION_MINUTES } from "../../../../domain/entities/appointment";

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
