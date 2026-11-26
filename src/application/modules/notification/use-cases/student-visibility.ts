import { Uuid } from "@wave-telecom/framework/core";
import { StudentAccessService } from "../../../../domain/services/student-access-service";

// Ids, entre os informados, dos alunos que o educador ainda acessa (dono ou
// compartilhado). Notificação de aluno transferido, descompartilhado ou
// excluído some da lista e do contador (NT-03, EQ-14).
export async function loadAccessibleStudentIds(
  studentAccess: StudentAccessService,
  studentIds: Uuid[],
  educatorId: Uuid
): Promise<Set<string>> {
  return studentAccess.accessibleIdsAmong(studentIds, educatorId);
}
