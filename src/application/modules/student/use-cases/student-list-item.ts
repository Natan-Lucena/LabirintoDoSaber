import { Student, StudentStatus } from "../../../../domain/entities/student";
import { StudentAccessKind } from "../../../../domain/services/student-access-service";
import { mapStudentToResponse } from "../../../../infraestructure/mappers/map-student";

// Filtro de status das listas de alunos (PA-03); o padrão é ACTIVE.
export type StudentStatusFilter = StudentStatus | "ALL";

export const matchesStatus = (student: Student, filter: StudentStatusFilter) =>
  filter === "ALL" || student.status === filter;

// Aluno no formato de GET /student/ (EQ-13): ownerName só nos compartilhados.
export const mapStudentListItem = (
  student: Student,
  access: StudentAccessKind,
  ownerName?: string
) => ({
  ...mapStudentToResponse(student),
  access,
  ...(access === "SHARED" && ownerName ? { ownerName } : {}),
});
