import { Uuid } from "@wave-telecom/framework/core";
import { StudentShare } from "../entities/student-share";

export interface StudentShareRepository {
  // Idempotente: se já existe o par (studentId, educatorId), não faz nada.
  create(share: StudentShare): Promise<void>;
  find(studentId: Uuid, educatorId: Uuid): Promise<StudentShare | null>;
  // Ordenado por sharedAt.
  listByStudentId(studentId: Uuid): Promise<StudentShare[]>;
  // Pacientes compartilhados com o educador.
  listByEducatorId(educatorId: Uuid): Promise<StudentShare[]>;
  // Todos os compartilhamentos dos alunos informados (cron de notificações).
  listByStudentIds(studentIds: Uuid[]): Promise<StudentShare[]>;
  // Dos alunos informados, os compartilhamentos com o educador (lote).
  listByStudentIdsAndEducator(studentIds: Uuid[], educatorId: Uuid): Promise<StudentShare[]>;
  delete(studentId: Uuid, educatorId: Uuid): Promise<void>;
  // Transferência: o novo dono recompartilha se quiser.
  deleteByStudentId(studentId: Uuid): Promise<void>;
  // EQ-09: apaga os compartilhamentos com o educador e os dos alunos
  // informados (os dele). Devolve quantos apagou.
  deleteForEducatorDeparture(educatorId: Uuid, ownedStudentIds: Uuid[]): Promise<number>;
}
