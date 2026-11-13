import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { NotificationRepository } from "../../../../../domain/repositories/notification-repository";
import { mapNotificationToResponse } from "../../../../../infraestructure/mappers/map-notification";

export interface MarkNotificationReadUseCaseRequest {
  educatorId: Uuid;
  notificationId: string;
}

export class MarkNotificationReadUseCase {
  constructor(private notificationRepository: NotificationRepository) {}

  async execute(request: MarkNotificationReadUseCaseRequest) {
    if (!Uuid.isValid(request.notificationId)) {
      return failure("NOTIFICATION_NOT_FOUND");
    }

    const notification = await this.notificationRepository.findById(
      new Uuid(request.notificationId)
    );
    if (!notification) return failure("NOTIFICATION_NOT_FOUND");
    if (notification.educatorId.value !== request.educatorId.value) {
      return failure("UNAUTHORIZED");
    }

    // Já lida: mantém a data da primeira leitura, sem gravar de novo.
    if (notification.isRead) return success(mapNotificationToResponse(notification));

    const read = notification.markRead();
    await this.notificationRepository.save(read);

    return success(mapNotificationToResponse(read));
  }
}
