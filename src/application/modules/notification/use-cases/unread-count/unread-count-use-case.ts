import { success, Uuid } from "@wave-telecom/framework/core";
import { NotificationRepository } from "../../../../../domain/repositories/notification-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { loadOwnedStudentIds } from "../student-visibility";

export interface UnreadCountUseCaseRequest {
  educatorId: Uuid;
}

export class UnreadCountUseCase {
  constructor(
    private notificationRepository: NotificationRepository,
    private studentRepository: StudentRepository
  ) {}

  // Conta só o que a lista mostra: as de aluno que não é mais do educador
  // ficam de fora (NT-03).
  async execute(request: UnreadCountUseCaseRequest) {
    const groups = await this.notificationRepository.countUnreadByStudent(
      request.educatorId
    );
    const owned = await loadOwnedStudentIds(
      this.studentRepository,
      groups.flatMap((g) => (g.studentId ? [g.studentId] : [])),
      request.educatorId
    );

    const count = groups
      .filter((g) => !g.studentId || owned.has(g.studentId.value))
      .reduce((total, g) => total + g.count, 0);

    return success({ count });
  }
}
