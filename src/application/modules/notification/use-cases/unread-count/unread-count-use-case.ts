import { success, Uuid } from "@wave-telecom/framework/core";
import { NotificationRepository } from "../../../../../domain/repositories/notification-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { loadAccessibleStudentIds } from "../student-visibility";

export interface UnreadCountUseCaseRequest {
  educatorId: Uuid;
}

export class UnreadCountUseCase {
  constructor(
    private notificationRepository: NotificationRepository,
    private studentAccess: StudentAccessService
  ) {}

  // Conta só o que a lista mostra: as de aluno que o educador não acessa mais
  // (dono ou compartilhado) ficam de fora (NT-03).
  async execute(request: UnreadCountUseCaseRequest) {
    const groups = await this.notificationRepository.countUnreadByStudent(
      request.educatorId
    );
    const accessible = await loadAccessibleStudentIds(
      this.studentAccess,
      groups.flatMap((g) => (g.studentId ? [g.studentId] : [])),
      request.educatorId
    );

    const count = groups
      .filter((g) => !g.studentId || accessible.has(g.studentId.value))
      .reduce((total, g) => total + g.count, 0);

    return success({ count });
  }
}
