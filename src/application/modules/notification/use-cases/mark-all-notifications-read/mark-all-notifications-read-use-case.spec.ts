import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { MarkAllNotificationsReadUseCase } from "./mark-all-notifications-read-use-case";
import { UnreadCountUseCase } from "../unread-count/unread-count-use-case";
import { Notification } from "../../../../../domain/entities/notification";
import {
  makeNotificationRepository,
  makeStudent,
  makeStudentRepository,
} from "../test-fixtures";

describe("MarkAllNotificationsReadUseCase", () => {
  const educatorId = Uuid.random();
  const otherEducatorId = Uuid.random();
  const ana = makeStudent(educatorId, "Ana");
  const bia = makeStudent(otherEducatorId, "Bia");

  let notificationRepository: ReturnType<typeof makeNotificationRepository>;
  let useCase: MarkAllNotificationsReadUseCase;
  let unreadCount: UnreadCountUseCase;

  const notification = (educator: Uuid, student = ana) =>
    Notification.evolutionPending({
      educatorId: educator,
      date: "2026-11-12",
      studentId: student.id,
      firstName: student.firstName,
      sessionId: Uuid.random(),
    });

  beforeEach(() => {
    notificationRepository = makeNotificationRepository();
    useCase = new MarkAllNotificationsReadUseCase(notificationRepository);
    unreadCount = new UnreadCountUseCase(
      notificationRepository,
      makeStudentRepository(() => [ana, bia])
    );
  });

  it("should mark every unread notification of the educator and zero the count", async () => {
    notificationRepository.store.push(
      notification(educatorId),
      notification(educatorId),
      notification(educatorId).markRead(),
      notification(otherEducatorId, bia)
    );

    const result = await useCase.execute({ educatorId });

    expect(result).toEqual({ ok: true, value: { updated: 2 } });
    expect(await unreadCount.execute({ educatorId })).toEqual({ ok: true, value: { count: 0 } });
    expect(
      await unreadCount.execute({ educatorId: otherEducatorId })
    ).toEqual({ ok: true, value: { count: 1 } });
  });
});
