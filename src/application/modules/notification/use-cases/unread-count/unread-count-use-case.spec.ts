import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { UnreadCountUseCase } from "./unread-count-use-case";
import { Notification } from "../../../../../domain/entities/notification";
import { Student } from "../../../../../domain/entities/student";
import {
  makeNotificationRepository,
  makeStudent,
  makeStudentRepository,
} from "../test-fixtures";

describe("UnreadCountUseCase", () => {
  const educatorId = Uuid.random();
  let students: Student[];
  let notificationRepository: ReturnType<typeof makeNotificationRepository>;
  let useCase: UnreadCountUseCase;

  const planReview = (student: Student, educator = educatorId) =>
    Notification.planReviewDue({
      educatorId: educator,
      date: "2026-11-12",
      studentId: student.id,
      firstName: student.firstName,
      planId: Uuid.random(),
      nextReviewDate: "2026-11-13",
    });

  beforeEach(() => {
    students = [];
    notificationRepository = makeNotificationRepository();
    useCase = new UnreadCountUseCase(
      notificationRepository,
      makeStudentRepository(() => students)
    );
  });

  it("should count the unread notifications the educator can see", async () => {
    const ana = makeStudent(educatorId, "Ana");
    const transferred = makeStudent(Uuid.random(), "Carla");
    students = [ana, transferred];
    notificationRepository.store.push(
      planReview(ana),
      planReview(ana),
      planReview(ana).markRead(),
      // Aluno transferido: some da lista, então não entra no contador (NT-03).
      planReview(transferred),
      Notification.appointmentsToday({ educatorId, date: "2026-11-12", count: 1 }),
      planReview(ana, Uuid.random())
    );

    const result = await useCase.execute({ educatorId });

    expect(result).toEqual({ ok: true, value: { count: 3 } });
  });

  it("should return zero without querying students when nothing is unread", async () => {
    const result = await useCase.execute({ educatorId });

    expect(result).toEqual({ ok: true, value: { count: 0 } });
  });
});
