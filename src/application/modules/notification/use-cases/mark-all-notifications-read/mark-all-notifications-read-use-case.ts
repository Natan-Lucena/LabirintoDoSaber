import { success, Uuid } from "@wave-telecom/framework/core";
import { NotificationRepository } from "../../../../../domain/repositories/notification-repository";

export interface MarkAllNotificationsReadUseCaseRequest {
  educatorId: Uuid;
}

export class MarkAllNotificationsReadUseCase {
  constructor(private notificationRepository: NotificationRepository) {}

  async execute(request: MarkAllNotificationsReadUseCaseRequest) {
    const updated = await this.notificationRepository.markAllRead(
      request.educatorId,
      new Date()
    );
    return success({ updated });
  }
}
