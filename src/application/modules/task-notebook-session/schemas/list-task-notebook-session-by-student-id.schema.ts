import z from "zod";

export const listTaskNotebookSessionByStudentId = z.object({
  // Id inválido vira 404 STUDENT_NOT_FOUND no use case.
  studentId: z.string().min(1),
});
