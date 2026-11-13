import { Uuid } from "@wave-telecom/framework/core";
import { StudentRepository } from "../../../../domain/repositories/student-repository";

// Ids, entre os informados, dos alunos que ainda são do educador. Notificação
// de aluno transferido ou excluído some da lista e do contador (NT-03).
export async function loadOwnedStudentIds(
  studentRepository: StudentRepository,
  studentIds: Uuid[],
  educatorId: Uuid
): Promise<Set<string>> {
  const unique = [...new Set(studentIds.map((id) => id.value))];
  if (unique.length === 0) return new Set();

  const students = await studentRepository.getByIds(unique.map((id) => new Uuid(id)));
  return new Set(
    students
      .filter((student) => student.educatorId.value === educatorId.value)
      .map((student) => student.id.value)
  );
}
