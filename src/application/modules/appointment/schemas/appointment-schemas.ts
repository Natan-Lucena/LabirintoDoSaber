import { z } from "zod";

export const createAppointmentSchema = z.object({
  studentId: z.string().uuid(),
  scheduledAt: z.string().datetime(),
  observation: z.string().optional(),
});

export const updateAppointmentSchema = z.object({
  scheduledAt: z.string().datetime().optional(),
  observation: z.string().nullable().optional(),
});
