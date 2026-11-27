import z from "zod";

const status = z.enum(["ACTIVE", "ARCHIVED"]);

// ?status= de GET /student/ e GET /student/overview (PA-03).
export const studentStatusQuerySchema = z.object({
  status: z.enum(["ACTIVE", "ARCHIVED", "ALL"]).default("ACTIVE"),
});

// PUT /student/:id/status (PA-02, PA-05).
export const changeStudentStatusSchema = z.object({
  status,
  cancelFutureAppointments: z.boolean().optional(),
});
