import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { NotificationRepository } from "../../../../../domain/repositories/notification-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { mapNotificationToResponse } from "../../../../../infraestructure/mappers/map-notification";
import {
  decodeNotificationCursor,
  encodeNotificationCursor,
} from "../notification-cursor";
import { loadOwnedStudentIds } from "../student-visibility";

export interface ListNotificationsUseCaseRequest {
  educatorId: Uuid;
  unreadOnly: boolean;
  limit: number;
  cursor?: string;
}

export class ListNotificationsUseCase {
  constructor(
    private notificationRepository: NotificationRepository,
    private studentRepository: StudentRepository
  ) {}

  async execute(request: ListNotificationsUseCaseRequest) {
    const after = request.cursor ? decodeNotificationCursor(request.cursor) : undefined;
    if (request.cursor && !after) return failure("INVALID_CURSOR");

    // Uma a mais para saber se existe próxima página.
    const page = await this.notificationRepository.list({
      educatorId: request.educatorId,
      unreadOnly: request.unreadOnly,
      limit: request.limit + 1,
      after,
    });
    const hasMore = page.length > request.limit;
    const items = page.slice(0, request.limit);

    // O cursor vem da página antes do filtro do NT-03: as escondidas não
    // travam a paginação, só deixam a página menor.
    const last = items[items.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeNotificationCursor({ createdAt: last.createdAt, id: last.id.value })
        : undefined;

    const owned = await loadOwnedStudentIds(
      this.studentRepository,
      items.flatMap((n) => (n.studentId ? [n.studentId] : [])),
      request.educatorId
    );
    const visible = items.filter((n) => !n.studentId || owned.has(n.studentId.value));

    return success({ items: visible.map(mapNotificationToResponse), nextCursor });
  }
}
