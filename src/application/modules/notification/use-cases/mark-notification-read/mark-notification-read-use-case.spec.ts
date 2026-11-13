import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { MarkNotificationReadUseCase } from "./mark-notification-read-use-case";
import { UnreadCountUseCase } from "../unread-count/unread-count-use-case";
import { Notification } from "../../../../../domain/entities/notification";
import {
  makeNotificationRepository,
  makeStudent,
  makeStudentRepository,
} from "../test-fixtures";

describe("MarkNotificationReadUseCase", () => {
  const educatorId = Uuid.random();
  const ana = makeStudent(educatorId, "Ana");

  let notificationRepository: ReturnType<typeof makeNotificationRepository>;
  let useCase: MarkNotificationReadUseCase;
  let unreadCount: UnreadCountUseCase;

  const notification = (educator = educatorId) =>
    Notification.evolutionPending({
      educatorId: educator,
      date: "2026-11-12",
      studentId: ana.id,
      firstName: ana.firstName,
      sessionId: Uuid.random(),
    });

  beforeEach(() => {
    notificationRepository = makeNotificationRepository();
    useCase = new MarkNotificationReadUseCase(notificationRepository);
    unreadCount = new UnreadCountUseCase(
      notificationRepository,
      makeStudentRepository(() => [ana])
    );
  });

  it("should mark the notification as read and decrease the unread count", async () => {
    const first = notification();
    notificationRepository.store.push(first, notification());
    expect(await unreadCount.execute({ educatorId })).toEqual({ ok: true, value: { count: 2 } });

    const result = await useCase.execute({ educatorId, notificationId: first.id.value });

    expect(result.ok && result.value.readAt).toBeInstanceOf(Date);
    expect(await unreadCount.execute({ educatorId })).toEqual({ ok: true, value: { count: 1 } });
  });

  it("should keep the first read date when read again", async () => {
    const read = notification().markRead(new Date("2026-11-10T10:00:00.000Z"));
    notificationRepository.store.push(read);

    const result = await useCase.execute({ educatorId, notificationId: read.id.value });

    expect(result.ok && result.value.readAt).toEqual(new Date("2026-11-10T10:00:00.000Z"));
    expect(notificationRepository.save).not.toHaveBeenCalled();
  });

  it("should return UNAUTHORIZED for a notification of another educator", async () => {
    const foreign = notification(Uuid.random());
    notificationRepository.store.push(foreign);

    const result = await useCase.execute({ educatorId, notificationId: foreign.id.value });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(notificationRepository.save).not.toHaveBeenCalled();
  });

  it("should return NOTIFICATION_NOT_FOUND for a missing or non-UUID id", async () => {
    expect(
      await useCase.execute({ educatorId, notificationId: Uuid.random().value })
    ).toEqual({ ok: false, error: "NOTIFICATION_NOT_FOUND" });
    expect(await useCase.execute({ educatorId, notificationId: "abc" })).toEqual({
      ok: false,
      error: "NOTIFICATION_NOT_FOUND",
    });
  });
});
