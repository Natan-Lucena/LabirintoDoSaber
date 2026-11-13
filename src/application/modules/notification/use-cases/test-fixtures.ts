// Fábricas e repositório em memória para os specs do módulo de notificações.
import { vi } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { Gender, Student } from "../../../../domain/entities/student";
import { Notification } from "../../../../domain/entities/notification";
import {
  ListNotificationsParams,
  NotificationRepository,
} from "../../../../domain/repositories/notification-repository";
import { StudentRepository } from "../../../../domain/repositories/student-repository";

export const makeStudent = (educatorId: Uuid, name = "Ana Clara Souza") =>
  Student.create({
    name,
    age: 8,
    gender: Gender.Female,
    zipcode: "00000000",
    road: "Rua",
    housenumber: "1",
    phonenumber: "11999999999",
    learningTopics: [],
    educators: [],
    educatorId,
  });

export const makeStudentRepository = (students: () => Student[]) =>
  ({
    getByIds: vi.fn(async (ids: Uuid[]) => {
      const wanted = new Set(ids.map((id) => id.value));
      return students().filter((s) => wanted.has(s.id.value));
    }),
  }) as unknown as StudentRepository;

const newestFirst = (a: Notification, b: Notification) =>
  b.createdAt.getTime() - a.createdAt.getTime() ||
  (b.id.value < a.id.value ? -1 : b.id.value > a.id.value ? 1 : 0);

// Respeita o índice único em dedupeKey, como o repositório Prisma.
export const makeNotificationRepository = () => {
  const store: Notification[] = [];

  const repository = {
    store,
    createMany: vi.fn(async (notifications: Notification[]) => {
      let created = 0;
      for (const n of notifications) {
        if (store.some((s) => s.dedupeKey === n.dedupeKey)) continue;
        store.push(n);
        created++;
      }
      return created;
    }),
    deleteCreatedBefore: vi.fn(async (date: Date) => {
      const before = store.length;
      const kept = store.filter((n) => n.createdAt >= date);
      store.splice(0, store.length, ...kept);
      return before - kept.length;
    }),
    save: vi.fn(async (notification: Notification) => {
      const index = store.findIndex((n) => n.id.value === notification.id.value);
      if (index >= 0) store[index] = notification;
      else store.push(notification);
    }),
    findById: vi.fn(
      async (id: Uuid) => store.find((n) => n.id.value === id.value) ?? null
    ),
    list: vi.fn(async (params: ListNotificationsParams) => {
      const after = params.after;
      return store
        .filter((n) => n.educatorId.value === params.educatorId.value)
        .filter((n) => !params.unreadOnly || !n.isRead)
        .filter(
          (n) =>
            !after ||
            n.createdAt.getTime() < after.createdAt.getTime() ||
            (n.createdAt.getTime() === after.createdAt.getTime() &&
              n.id.value < after.id)
        )
        .sort(newestFirst)
        .slice(0, params.limit);
    }),
    countUnreadByStudent: vi.fn(async (educatorId: Uuid) => {
      const counts = new Map<string, number>();
      for (const n of store) {
        if (n.educatorId.value !== educatorId.value || n.isRead) continue;
        const key = n.studentId?.value ?? "";
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      return [...counts].map(([studentId, count]) => ({
        studentId: studentId ? new Uuid(studentId) : undefined,
        count,
      }));
    }),
    markAllRead: vi.fn(async (educatorId: Uuid, readAt: Date) => {
      let updated = 0;
      store.forEach((n, index) => {
        if (n.educatorId.value !== educatorId.value || n.isRead) return;
        store[index] = n.markRead(readAt);
        updated++;
      });
      return updated;
    }),
  };

  return repository as typeof repository & NotificationRepository;
};
