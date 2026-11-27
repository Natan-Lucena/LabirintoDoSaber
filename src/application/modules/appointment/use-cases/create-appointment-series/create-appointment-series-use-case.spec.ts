import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { CreateAppointmentSeriesUseCase } from "./create-appointment-series-use-case";
import { Appointment, AppointmentStatus } from "../../../../../domain/entities/appointment";
import { RecurrenceFrequency } from "../../../../../domain/entities/appointment-series";
import {
  addDays,
  atTimeInSaoPaulo,
  dateInSaoPaulo,
  timeInSaoPaulo,
  todayInSaoPaulo,
} from "../../../../../domain/utils/date-only";
import {
  makeAppointmentRepositoryFake,
  makeAppointmentSeriesRepositoryFake,
  makeSchedulerMock,
} from "../../../../../domain/tests/fakes/appointment-fakes";
import {
  makeStudentAccess,
  makeStudentRepositoryFake,
  shareStudent,
} from "../../../../../domain/tests/fakes/student-share-fakes";
import { makeStudent } from "../../../session-evolution/use-cases/test-fixtures";

// Daqui a uma semana, 14:00 em São Paulo.
const firstDate = addDays(todayInSaoPaulo(), 7);
const firstScheduledAt = atTimeInSaoPaulo(firstDate, "14:00:00.000");

describe("CreateAppointmentSeriesUseCase", () => {
  const educatorId = Uuid.random();
  const student = makeStudent(educatorId);

  let appointmentRepository: ReturnType<typeof makeAppointmentRepositoryFake>;
  let seriesRepository: ReturnType<typeof makeAppointmentSeriesRepositoryFake>;
  let scheduler: ReturnType<typeof makeSchedulerMock>;
  let useCase: CreateAppointmentSeriesUseCase;

  const buildUseCase = (students = [student], shares: ReturnType<typeof shareStudent>[] = []) =>
    new CreateAppointmentSeriesUseCase(
      appointmentRepository,
      seriesRepository,
      scheduler,
      makeStudentAccess(makeStudentRepositoryFake(students), shares)
    );

  const request = (overrides: Partial<Parameters<CreateAppointmentSeriesUseCase["execute"]>[0]> = {}) => ({
    educatorId,
    studentId: student.id.value,
    scheduledAt: firstScheduledAt,
    frequency: RecurrenceFrequency.WEEKLY,
    occurrences: 8,
    ...overrides,
  });

  // Atendimento já marcado pelo educador, com outro aluno.
  const existingAt = (scheduledAt: Date, overrides: Partial<Parameters<typeof Appointment.create>[0]> = {}) =>
    Appointment.create({
      educatorId,
      studentId: Uuid.random(),
      scheduledAt,
      ...overrides,
    });

  beforeEach(() => {
    appointmentRepository = makeAppointmentRepositoryFake();
    seriesRepository = makeAppointmentSeriesRepositoryFake();
    scheduler = makeSchedulerMock();
    useCase = buildUseCase();
  });

  // BE-RC-01
  it("should create 7 of 8 weekly occurrences and list the conflicting one in skipped", async () => {
    const conflictDay = addDays(firstDate, 14);
    const conflicting = existingAt(atTimeInSaoPaulo(conflictDay, "14:30:00.000"));
    appointmentRepository.store.set(conflicting.id.value, conflicting);

    const result = await useCase.execute(request({ type: "Sessão", durationMinutes: 60 }));

    if (!result.ok) throw new Error(`unexpected failure: ${JSON.stringify(result.error)}`);
    const { series, created, skipped } = result.value;

    expect(created).toHaveLength(7);
    expect(skipped).toEqual([
      {
        scheduledAt: atTimeInSaoPaulo(conflictDay, "14:00:00.000"),
        reason: "CONFLICT",
        conflictingAppointmentId: conflicting.id.value,
      },
    ]);
    expect(created.map((appointment) => dateInSaoPaulo(appointment.scheduledAt))).not.toContain(
      conflictDay
    );
    for (const appointment of created) {
      expect(appointment.seriesId?.value).toBe(series.id.value);
      expect(appointment.status).toBe(AppointmentStatus.PENDING);
      expect(appointment.type).toBe("Sessão");
      expect(appointment.durationMinutes).toBe(60);
      expect(appointment.educatorId.value).toBe(educatorId.value);
      expect(appointment.studentId.value).toBe(student.id.value);
    }

    expect(series.occurrences).toBe(8);
    expect(series.firstScheduledAt).toEqual(firstScheduledAt);
    expect(seriesRepository.store.get(series.id.value)).toBe(series);
    // As 7 criadas mais o atendimento que já existia.
    expect(appointmentRepository.store.size).toBe(8);
  });

  // BE-RC-03 e RC-02
  it("should keep every occurrence on the same weekday at 14:00 in São Paulo", async () => {
    const result = await useCase.execute(request());

    if (!result.ok) throw new Error("unexpected failure");
    const dates = result.value.created.map((appointment) => appointment.scheduledAt);
    expect(dates.map(dateInSaoPaulo)).toEqual(
      Array.from({ length: 8 }, (_, index) => addDays(firstDate, index * 7))
    );
    for (const date of dates) {
      expect(timeInSaoPaulo(date)).toBe("14:00:00.000");
    }
  });

  it("should space biweekly occurrences 14 days apart", async () => {
    const result = await useCase.execute(
      request({ frequency: RecurrenceFrequency.BIWEEKLY, occurrences: 3 })
    );

    if (!result.ok) throw new Error("unexpected failure");
    expect(result.value.series.frequency).toBe(RecurrenceFrequency.BIWEEKLY);
    expect(result.value.created.map((appointment) => dateInSaoPaulo(appointment.scheduledAt))).toEqual([
      firstDate,
      addDays(firstDate, 14),
      addDays(firstDate, 28),
    ]);
  });

  it("should reject a series longer than 6 months without saving anything", async () => {
    const result = await useCase.execute(
      request({ frequency: RecurrenceFrequency.BIWEEKLY, occurrences: 14 })
    );

    expect(result).toEqual({ ok: false, error: "SERIES_TOO_LONG" });
    expect(seriesRepository.save).not.toHaveBeenCalled();
    expect(appointmentRepository.save).not.toHaveBeenCalled();
  });

  it("should fail with APPOINTMENT_CONFLICT and create nothing when every occurrence conflicts", async () => {
    const conflicts = Array.from({ length: 3 }, (_, index) =>
      existingAt(atTimeInSaoPaulo(addDays(firstDate, index * 7), "13:30:00.000"))
    );
    for (const conflict of conflicts) appointmentRepository.store.set(conflict.id.value, conflict);

    const result = await useCase.execute(request({ occurrences: 3 }));

    expect(result).toEqual({
      ok: false,
      error: { code: "APPOINTMENT_CONFLICT", conflictingAppointmentId: conflicts[0].id.value },
    });
    expect(seriesRepository.save).not.toHaveBeenCalled();
    expect(appointmentRepository.save).not.toHaveBeenCalled();
    expect(scheduler.ensureScheduled).not.toHaveBeenCalled();
  });

  it("should ignore cancelled appointments and other educators' appointments when looking for conflicts", async () => {
    const at = atTimeInSaoPaulo(firstDate, "14:00:00.000");
    const cancelled = existingAt(at, { status: AppointmentStatus.CANCELLED });
    const otherEducator = existingAt(at, { educatorId: Uuid.random() });
    appointmentRepository.store.set(cancelled.id.value, cancelled);
    appointmentRepository.store.set(otherEducator.id.value, otherEducator);

    const result = await useCase.execute(request({ occurrences: 2 }));

    if (!result.ok) throw new Error("unexpected failure");
    expect(result.value.created).toHaveLength(2);
    expect(result.value.skipped).toEqual([]);
  });

  it("should not treat an appointment ending right when the occurrence starts as a conflict", async () => {
    const before = existingAt(atTimeInSaoPaulo(firstDate, "13:10:00.000"));
    appointmentRepository.store.set(before.id.value, before);

    const result = await useCase.execute(request({ occurrences: 2 }));

    if (!result.ok) throw new Error("unexpected failure");
    expect(result.value.created).toHaveLength(2);
  });

  it("should start the reminder chain once with the first created occurrence, after saving", async () => {
    const order: string[] = [];
    appointmentRepository.save.mockImplementation(async (appointment: Appointment) => {
      order.push("save");
      appointmentRepository.store.set(appointment.id.value, appointment);
    });
    scheduler.ensureScheduled.mockImplementation(async () => {
      order.push("ensureScheduled");
    });
    // A primeira ocorrência conflita: a cadeia começa pela segunda.
    const conflicting = existingAt(firstScheduledAt);
    appointmentRepository.store.set(conflicting.id.value, conflicting);

    const result = await useCase.execute(request({ occurrences: 3 }));

    if (!result.ok) throw new Error("unexpected failure");
    expect(scheduler.ensureScheduled).toHaveBeenCalledOnce();
    expect(scheduler.ensureScheduled.mock.calls[0][0].id.value).toBe(result.value.created[0].id.value);
    expect(dateInSaoPaulo(result.value.created[0].scheduledAt)).toBe(addDays(firstDate, 7));
    expect(order).toEqual(["save", "save", "ensureScheduled"]);
  });

  // RC-08
  it("should reject an archived student with STUDENT_ARCHIVED", async () => {
    const archived = makeStudent(educatorId);
    archived.archive(new Date());
    useCase = buildUseCase([archived]);

    const result = await useCase.execute(request({ studentId: archived.id.value }));

    expect(result).toEqual({ ok: false, error: "STUDENT_ARCHIVED" });
    expect(seriesRepository.save).not.toHaveBeenCalled();
    expect(appointmentRepository.save).not.toHaveBeenCalled();
  });

  it("should return STUDENT_NOT_FOUND for an unknown student", async () => {
    const result = await useCase.execute(request({ studentId: Uuid.random().value }));

    expect(result).toEqual({ ok: false, error: "STUDENT_NOT_FOUND" });
  });

  it("should return UNAUTHORIZED for a student out of the educator's reach", async () => {
    const result = await useCase.execute(request({ educatorId: Uuid.random() }));

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(seriesRepository.save).not.toHaveBeenCalled();
  });

  it("should let the educator the student was shared with create a series in their own agenda", async () => {
    const colleagueId = Uuid.random();
    useCase = buildUseCase([student], [shareStudent(student, colleagueId)]);

    const result = await useCase.execute(request({ educatorId: colleagueId, occurrences: 2 }));

    if (!result.ok) throw new Error("unexpected failure");
    expect(result.value.series.educatorId.value).toBe(colleagueId.value);
    expect(result.value.created.every((appointment) => appointment.educatorId.value === colleagueId.value)).toBe(
      true
    );
  });
});
