import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { GenerateDailyNotificationsUseCase } from "./generate-daily-notifications-use-case";
import {
  Appointment,
  AppointmentStatus,
} from "../../../../../domain/entities/appointment";
import {
  Notification,
  NotificationKind,
  NotificationTargetType,
} from "../../../../../domain/entities/notification";
import { Plan, PlanSource, PlanStatus, PlanType } from "../../../../../domain/entities/plan";
import {
  ApplicationStatus,
  ScaleApplication,
} from "../../../../../domain/entities/scale-application";
import { Student } from "../../../../../domain/entities/student";
import { TaskNotebookSession } from "../../../../../domain/entities/task-notebook-session";
import {
  AppointmentRepository,
  SearchAppointmentParams,
} from "../../../../../domain/repositories/appointment-repository";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { ScaleApplicationRepository } from "../../../../../domain/repositories/scale-application-repository";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import {
  ListFinishedBetweenParams,
  TaskNotebookSessionRepository,
} from "../../../../../domain/repositories/task-notebook-session-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import {
  makeNotificationRepository,
  makeStudent,
  makeStudentRepository,
} from "../test-fixtures";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// 06:00 em São Paulo, horário do cron.
const NOW = new Date("2026-11-12T09:00:00.000Z");
const TODAY = "2026-11-12";
const ago = (ms: number) => new Date(NOW.getTime() - ms);

describe("GenerateDailyNotificationsUseCase", () => {
  const educatorA = Uuid.random();
  const educatorB = Uuid.random();

  let students: Student[];
  let appointments: Appointment[];
  let sessions: TaskNotebookSession[];
  let evolutionSessionIds: Set<string>;
  let plans: Plan[];
  let applications: ScaleApplication[];

  let appointmentRepository: AppointmentRepository;
  let sessionRepository: TaskNotebookSessionRepository;
  let evolutionRepository: SessionEvolutionRepository;
  let planRepository: PlanRepository;
  let scaleApplicationRepository: ScaleApplicationRepository;
  let studentRepository: StudentRepository;
  let notificationRepository: ReturnType<typeof makeNotificationRepository>;
  let useCase: GenerateDailyNotificationsUseCase;

  const ana = makeStudent(educatorA, "Ana Clara Souza");
  const bruno = makeStudent(educatorA, "Bruno Lima");
  // Era do educador A e foi transferida para o B.
  const carla = makeStudent(educatorB, "Carla Dias");

  const session = (studentId: Uuid, educatorId: Uuid, finishedAt: Date) =>
    new TaskNotebookSession(
      Uuid.random(),
      studentId,
      educatorId,
      "Sessão",
      new Date(finishedAt.getTime() - HOUR),
      finishedAt
    );

  const plan = (studentId: Uuid, educatorId: Uuid, nextReviewDate: string) => {
    const created = Plan.create({
      educatorId,
      studentId,
      type: PlanType.PDI,
      source: PlanSource.MANUAL,
      title: "PDI",
      generalObjective: "Objetivo",
      startDate: "2026-10-01",
      endDate: "2027-03-01",
      nextReviewDate,
      goals: [{ description: "Ler sílabas" }],
    });
    if (!created.ok) throw new Error(created.error);
    return created.value;
  };

  const application = (
    studentId: Uuid,
    updatedAt: Date,
    status = ApplicationStatus.DRAFT
  ) =>
    ScaleApplication.fromPersistence({
      id: Uuid.random(),
      templateId: Uuid.random(),
      templateCode: "SNAP-IV",
      templateVersion: 1,
      templateName: "SNAP-IV",
      studentId,
      educatorId: educatorA,
      status,
      answers: [],
      startedAt: updatedAt,
      updatedAt,
    });

  const appointment = (scheduledAt: string, status = AppointmentStatus.PENDING, educatorId = educatorA) =>
    Appointment.create({
      educatorId,
      studentId: ana.id,
      scheduledAt: new Date(scheduledAt),
      status,
    });

  const ofKind = (kind: NotificationKind) =>
    notificationRepository.store.filter((n) => n.kind === kind);

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });

    students = [ana, bruno, carla];
    appointments = [];
    sessions = [];
    evolutionSessionIds = new Set();
    plans = [];
    applications = [];

    // Os repositórios em memória aplicam os mesmos filtros das consultas reais.
    appointmentRepository = {
      search: vi.fn(async (params: SearchAppointmentParams) =>
        appointments.filter(
          (a) =>
            (!params.status || a.status === params.status) &&
            (!params.scheduledAfter || a.scheduledAt >= params.scheduledAfter) &&
            (!params.scheduledBefore || a.scheduledAt <= params.scheduledBefore)
        )
      ),
    } as unknown as AppointmentRepository;

    sessionRepository = {
      listFinishedBetween: vi.fn(async (params: ListFinishedBetweenParams) =>
        sessions.filter(
          (s) => s.finishedAt! >= params.from && s.finishedAt! <= params.to
        )
      ),
    } as unknown as TaskNotebookSessionRepository;

    evolutionRepository = {
      findIdsBySessionIds: vi.fn(async (ids: Uuid[]) =>
        new Map(
          ids
            .filter((id) => evolutionSessionIds.has(id.value))
            .map((id) => [id.value, Uuid.random().value])
        )
      ),
    } as unknown as SessionEvolutionRepository;

    planRepository = {
      listActiveWithReviewDueBy: vi.fn(async (date: string) =>
        plans.filter(
          (p) =>
            p.status === PlanStatus.ACTIVE &&
            p.nextReviewDate !== undefined &&
            p.nextReviewDate <= date
        )
      ),
    } as unknown as PlanRepository;

    scaleApplicationRepository = {
      listDraftsUpdatedBefore: vi.fn(async (date: Date) =>
        applications.filter(
          (a) => a.status === ApplicationStatus.DRAFT && a.updatedAt <= date
        )
      ),
    } as unknown as ScaleApplicationRepository;

    studentRepository = makeStudentRepository(() => students);
    notificationRepository = makeNotificationRepository();

    useCase = new GenerateDailyNotificationsUseCase(
      appointmentRepository,
      sessionRepository,
      evolutionRepository,
      planRepository,
      scaleApplicationRepository,
      studentRepository,
      notificationRepository
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("APPOINTMENTS_TODAY", () => {
    it("should summarize the PENDING appointments of the day in Sao Paulo", async () => {
      appointments = [
        appointment("2026-11-12T13:00:00.000Z"),
        // 23:30 em São Paulo, ainda hoje.
        appointment("2026-11-13T02:30:00.000Z"),
        appointment("2026-11-12T15:00:00.000Z", AppointmentStatus.COMPLETED),
        appointment("2026-11-12T16:00:00.000Z", AppointmentStatus.CANCELLED),
        // 00:00 de amanhã em São Paulo.
        appointment("2026-11-13T03:00:00.000Z"),
        // 23:59 de ontem em São Paulo.
        appointment("2026-11-12T02:59:00.000Z"),
      ];

      await useCase.execute();

      expect(appointmentRepository.search).toHaveBeenCalledTimes(1);
      expect(appointmentRepository.search).toHaveBeenCalledWith({
        status: AppointmentStatus.PENDING,
        scheduledAfter: new Date("2026-11-12T03:00:00.000Z"),
        scheduledBefore: new Date("2026-11-13T02:59:59.999Z"),
      });
      const [notification] = ofKind(NotificationKind.APPOINTMENTS_TODAY);
      expect(ofKind(NotificationKind.APPOINTMENTS_TODAY)).toHaveLength(1);
      expect(notification.educatorId.value).toBe(educatorA.value);
      expect(notification.title).toBe("2 atendimentos hoje");
      expect(notification.target).toEqual({
        type: NotificationTargetType.AGENDA_DAY,
        id: TODAY,
      });
      expect(notification.studentId).toBeUndefined();
      expect(notification.dedupeKey).toBe(
        `${educatorA.value}:APPOINTMENTS_TODAY:${TODAY}`
      );
    });

    it("should create one per educator", async () => {
      appointments = [
        appointment("2026-11-12T13:00:00.000Z"),
        appointment("2026-11-12T14:00:00.000Z", AppointmentStatus.PENDING, educatorB),
      ];

      await useCase.execute();

      expect(
        ofKind(NotificationKind.APPOINTMENTS_TODAY)
          .map((n) => [n.educatorId.value, n.title])
          .sort()
      ).toEqual(
        [
          [educatorA.value, "1 atendimento hoje"],
          [educatorB.value, "1 atendimento hoje"],
        ].sort()
      );
    });

    it("should not notify when the day has no PENDING appointment", async () => {
      appointments = [
        appointment("2026-11-12T15:00:00.000Z", AppointmentStatus.COMPLETED),
        appointment("2026-11-12T16:00:00.000Z", AppointmentStatus.CANCELLED),
      ];

      await useCase.execute();

      expect(ofKind(NotificationKind.APPOINTMENTS_TODAY)).toEqual([]);
    });
  });

  describe("EVOLUTION_PENDING", () => {
    it("should notify a session finished 25 h ago without evolution, with the first name only", async () => {
      const pending = session(ana.id, educatorA, ago(25 * HOUR));
      sessions = [pending];

      await useCase.execute();

      const notifications = ofKind(NotificationKind.EVOLUTION_PENDING);
      expect(notifications).toHaveLength(1);
      expect(notifications[0].educatorId.value).toBe(educatorA.value);
      expect(notifications[0].studentId?.value).toBe(ana.id.value);
      expect(notifications[0].target).toEqual({
        type: NotificationTargetType.SESSION,
        id: pending.id.value,
      });
      expect(notifications[0].body).toContain("Ana");
      expect(notifications[0].body).not.toContain("Clara");
      expect(notifications[0].body).not.toContain("Souza");
      expect(notifications[0].dedupeKey).toBe(
        `${educatorA.value}:EVOLUTION_PENDING:${pending.id.value}:${TODAY}`
      );
    });

    it("should not notify a session finished 25 h ago that has an evolution", async () => {
      const withEvolution = session(ana.id, educatorA, ago(25 * HOUR));
      sessions = [withEvolution];
      evolutionSessionIds.add(withEvolution.id.value);

      await useCase.execute();

      expect(ofKind(NotificationKind.EVOLUTION_PENDING)).toEqual([]);
    });

    it("should look only at sessions finished between 30 days and 24 h ago", async () => {
      sessions = [
        session(ana.id, educatorA, ago(23 * HOUR)),
        session(ana.id, educatorA, ago(31 * DAY)),
      ];

      await useCase.execute();

      expect(sessionRepository.listFinishedBetween).toHaveBeenCalledWith({
        from: ago(30 * DAY),
        to: ago(24 * HOUR),
      });
      expect(ofKind(NotificationKind.EVOLUTION_PENDING)).toEqual([]);
    });

    it("should skip sessions whose student is no longer the educator's", async () => {
      sessions = [session(carla.id, educatorA, ago(25 * HOUR))];

      await useCase.execute();

      expect(ofKind(NotificationKind.EVOLUTION_PENDING)).toEqual([]);
    });
  });

  describe("PLAN_REVIEW_DUE", () => {
    it("should notify ACTIVE plans with the review due in up to 2 days or overdue", async () => {
      const dueIn2Days = plan(ana.id, educatorA, "2026-11-14");
      const overdue = plan(bruno.id, educatorA, "2026-11-01");
      const dueIn3Days = plan(ana.id, educatorA, "2026-11-15");
      const closed = plan(bruno.id, educatorA, "2026-11-13").close(PlanStatus.COMPLETED);
      if (!closed.ok) throw new Error(closed.error);
      plans = [dueIn2Days, overdue, dueIn3Days, closed.value];

      await useCase.execute();

      expect(planRepository.listActiveWithReviewDueBy).toHaveBeenCalledWith("2026-11-14");
      const notifications = ofKind(NotificationKind.PLAN_REVIEW_DUE);
      expect(notifications.map((n) => n.target)).toEqual([
        { type: NotificationTargetType.PLAN, id: dueIn2Days.id.value },
        { type: NotificationTargetType.PLAN, id: overdue.id.value },
      ]);
      expect(notifications[0].body).toBe("A revisão do plano de Ana vence em 14/11.");
      expect(notifications[1].body).toBe("A revisão do plano de Bruno venceu em 01/11.");
      expect(notifications[0].dedupeKey).toBe(
        `${educatorA.value}:PLAN_REVIEW_DUE:${dueIn2Days.id.value}:${TODAY}`
      );
    });

    it("should notify the current owner of the student", async () => {
      plans = [plan(carla.id, educatorA, "2026-11-12")];

      await useCase.execute();

      const [notification] = ofKind(NotificationKind.PLAN_REVIEW_DUE);
      expect(notification.educatorId.value).toBe(educatorB.value);
      expect(notification.body).toContain("Carla");
    });
  });

  describe("SCALE_DRAFT_STALE", () => {
    it("should notify drafts untouched for 7 days or more", async () => {
      const stale = application(ana.id, ago(7 * DAY));
      const older = application(bruno.id, ago(12 * DAY));
      const fresh = application(ana.id, ago(6 * DAY));
      const completed = application(ana.id, ago(10 * DAY), ApplicationStatus.COMPLETED);
      applications = [stale, older, fresh, completed];

      await useCase.execute();

      expect(scaleApplicationRepository.listDraftsUpdatedBefore).toHaveBeenCalledWith(
        ago(7 * DAY)
      );
      const notifications = ofKind(NotificationKind.SCALE_DRAFT_STALE);
      expect(notifications.map((n) => n.target)).toEqual([
        { type: NotificationTargetType.SCALE_APPLICATION, id: stale.id.value },
        { type: NotificationTargetType.SCALE_APPLICATION, id: older.id.value },
      ]);
      expect(notifications[0].body).toBe(
        "A aplicação de SNAP-IV de Ana está parada há 7 dias."
      );
      expect(notifications[1].body).toContain("12 dias");
      expect(notifications[0].dedupeKey).toBe(
        `${educatorA.value}:SCALE_DRAFT_STALE:${stale.id.value}:${TODAY}`
      );
    });
  });

  describe("idempotency (NT-02)", () => {
    beforeEach(() => {
      appointments = [appointment("2026-11-12T13:00:00.000Z")];
      sessions = [session(ana.id, educatorA, ago(25 * HOUR))];
      plans = [plan(ana.id, educatorA, "2026-11-13")];
      applications = [application(bruno.id, ago(8 * DAY))];
    });

    it("should not duplicate when the cron runs twice on the same day", async () => {
      const first = await useCase.execute();
      const second = await useCase.execute();

      expect(first).toEqual({ ok: true, value: { created: 4, deleted: 0 } });
      expect(second).toEqual({ ok: true, value: { created: 0, deleted: 0 } });
      expect(notificationRepository.store).toHaveLength(4);
    });

    it("should create them again on the next day", async () => {
      await useCase.execute();
      vi.setSystemTime(new Date(NOW.getTime() + DAY));
      appointments.push(appointment("2026-11-13T13:00:00.000Z"));

      const nextDay = await useCase.execute();

      expect(nextDay.ok && nextDay.value.created).toBe(4);
      expect(notificationRepository.store).toHaveLength(8);
    });

    it("should load the students in a single batch, without one query per educator", async () => {
      appointments.push(
        appointment("2026-11-12T14:00:00.000Z", AppointmentStatus.PENDING, educatorB)
      );

      await useCase.execute();

      expect(appointmentRepository.search).toHaveBeenCalledTimes(1);
      expect(sessionRepository.listFinishedBetween).toHaveBeenCalledTimes(1);
      expect(planRepository.listActiveWithReviewDueBy).toHaveBeenCalledTimes(1);
      expect(scaleApplicationRepository.listDraftsUpdatedBefore).toHaveBeenCalledTimes(1);
      expect(studentRepository.getByIds).toHaveBeenCalledTimes(1);
      expect(notificationRepository.createMany).toHaveBeenCalledTimes(1);
    });
  });

  describe("retention (NT-04)", () => {
    it("should delete notifications older than 90 days", async () => {
      const at = (createdAt: Date) =>
        Notification.appointmentsToday({
          educatorId: educatorA,
          date: createdAt.toISOString().slice(0, 10),
          count: 1,
          now: createdAt,
        });
      const expired = at(ago(91 * DAY));
      const kept = at(ago(89 * DAY));
      notificationRepository.store.push(expired, kept);

      const result = await useCase.execute();

      expect(notificationRepository.deleteCreatedBefore).toHaveBeenCalledWith(ago(90 * DAY));
      expect(result).toEqual({ ok: true, value: { created: 0, deleted: 1 } });
      expect(notificationRepository.store.map((n) => n.id.value)).toEqual([kept.id.value]);
    });
  });

  it("should skip notifications of students that no longer exist", async () => {
    const removed = makeStudent(educatorA, "Diego");
    plans = [plan(removed.id, educatorA, "2026-11-12")];
    applications = [application(removed.id, ago(8 * DAY))];

    const result = await useCase.execute();

    expect(result).toEqual({ ok: true, value: { created: 0, deleted: 0 } });
  });
});
