import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { ListNotificationsUseCase } from "./list-notifications-use-case";
import { Notification } from "../../../../../domain/entities/notification";
import { Student } from "../../../../../domain/entities/student";
import {
  makeNotificationRepository,
  makeStudent,
  makeStudentRepository,
} from "../test-fixtures";

const MINUTE = 60 * 1000;
const BASE = new Date("2026-11-12T09:00:00.000Z");

describe("ListNotificationsUseCase", () => {
  const educatorId = Uuid.random();
  const otherEducatorId = Uuid.random();

  let ana: Student;
  let transferred: Student;
  let students: Student[];
  let notificationRepository: ReturnType<typeof makeNotificationRepository>;
  let useCase: ListNotificationsUseCase;

  const evolutionPending = (student: Student, minutesAgo: number, educator = educatorId) =>
    Notification.evolutionPending({
      educatorId: educator,
      date: "2026-11-12",
      studentId: student.id,
      firstName: student.firstName,
      sessionId: Uuid.random(),
      now: new Date(BASE.getTime() - minutesAgo * MINUTE),
    });

  const ids = (items: { id: string }[]) => items.map((item) => item.id);

  beforeEach(() => {
    ana = makeStudent(educatorId, "Ana");
    transferred = makeStudent(otherEducatorId, "Carla");
    students = [ana, transferred];
    notificationRepository = makeNotificationRepository();
    useCase = new ListNotificationsUseCase(
      notificationRepository,
      makeStudentRepository(() => students)
    );
  });

  it("should page by cursor, newest first, until there is no nextCursor", async () => {
    const created = [0, 1, 2, 3, 4].map((minutes) => evolutionPending(ana, minutes));
    notificationRepository.store.push(...[...created].reverse());

    const first = await useCase.execute({ educatorId, unreadOnly: false, limit: 2 });
    if (!first.ok) throw new Error(String(first.error));
    expect(ids(first.value.items)).toEqual([created[0].id.value, created[1].id.value]);
    expect(first.value.nextCursor).toEqual(expect.any(String));

    const second = await useCase.execute({
      educatorId,
      unreadOnly: false,
      limit: 2,
      cursor: first.value.nextCursor,
    });
    if (!second.ok) throw new Error(String(second.error));
    expect(ids(second.value.items)).toEqual([created[2].id.value, created[3].id.value]);

    const last = await useCase.execute({
      educatorId,
      unreadOnly: false,
      limit: 2,
      cursor: second.value.nextCursor,
    });
    if (!last.ok) throw new Error(String(last.error));
    expect(ids(last.value.items)).toEqual([created[4].id.value]);
    expect(last.value.nextCursor).toBeUndefined();
  });

  it("should break createdAt ties by id without skipping or repeating", async () => {
    const tied = [0, 0, 0].map(() => evolutionPending(ana, 0));
    notificationRepository.store.push(...tied);

    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await useCase.execute({ educatorId, unreadOnly: false, limit: 1, cursor });
      if (!page.ok) throw new Error(String(page.error));
      seen.push(...ids(page.value.items));
      cursor = page.value.nextCursor;
    } while (cursor);

    expect([...seen].sort()).toEqual(tied.map((n) => n.id.value).sort());
    expect(new Set(seen).size).toBe(3);
  });

  it("should map the notification to the response shape", async () => {
    const notification = evolutionPending(ana, 0);
    notificationRepository.store.push(notification);

    const result = await useCase.execute({ educatorId, unreadOnly: false, limit: 20 });

    expect(result).toEqual({
      ok: true,
      value: {
        items: [
          {
            id: notification.id.value,
            kind: "EVOLUTION_PENDING",
            title: notification.title,
            body: notification.body,
            target: notification.target,
            createdAt: notification.createdAt,
            readAt: undefined,
          },
        ],
        nextCursor: undefined,
      },
    });
  });

  it("should filter only unread when asked", async () => {
    const unread = evolutionPending(ana, 0);
    const read = evolutionPending(ana, 1).markRead();
    notificationRepository.store.push(unread, read);

    const result = await useCase.execute({ educatorId, unreadOnly: true, limit: 20 });

    expect(result.ok && ids(result.value.items)).toEqual([unread.id.value]);
  });

  it("should hide notifications of a student that is no longer the educator's (NT-03)", async () => {
    const kept = evolutionPending(ana, 0);
    const ofTransferred = evolutionPending(transferred, 1);
    const ofRemoved = evolutionPending(makeStudent(educatorId, "Removido"), 2);
    const withoutStudent = Notification.appointmentsToday({
      educatorId,
      date: "2026-11-12",
      count: 2,
      now: new Date(BASE.getTime() - 3 * MINUTE),
    });
    notificationRepository.store.push(kept, ofTransferred, ofRemoved, withoutStudent);

    const result = await useCase.execute({ educatorId, unreadOnly: false, limit: 20 });

    expect(result.ok && ids(result.value.items)).toEqual([
      kept.id.value,
      withoutStudent.id.value,
    ]);
  });

  it("should not list notifications of another educator", async () => {
    notificationRepository.store.push(evolutionPending(transferred, 0, otherEducatorId));

    const result = await useCase.execute({ educatorId, unreadOnly: false, limit: 20 });

    expect(result).toEqual({ ok: true, value: { items: [], nextCursor: undefined } });
  });

  it("should return INVALID_CURSOR for a malformed cursor", async () => {
    for (const cursor of ["nao-e-cursor", Buffer.from("x|y").toString("base64url")]) {
      const result = await useCase.execute({ educatorId, unreadOnly: false, limit: 20, cursor });
      expect(result).toEqual({ ok: false, error: "INVALID_CURSOR" });
    }
  });
});
