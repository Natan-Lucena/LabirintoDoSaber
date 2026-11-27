import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { CancelAppointmentSeriesUseCase } from "./cancel-appointment-series-use-case";
import { Appointment, AppointmentStatus } from "../../../../../domain/entities/appointment";
import { AppointmentSeries } from "../../../../../domain/entities/appointment-series";
import {
  addDays,
  atTimeInSaoPaulo,
  todayInSaoPaulo,
} from "../../../../../domain/utils/date-only";
import {
  makeAppointmentRepositoryFake,
  makeAppointmentSeriesRepositoryFake,
  makeSchedulerMock,
  seedSeries,
} from "../../../../../domain/tests/fakes/appointment-fakes";
import {
  makeStudentAccess,
  makeStudentRepositoryFake,
  shareStudent,
} from "../../../../../domain/tests/fakes/student-share-fakes";
import { makeStudent } from "../../../session-evolution/use-cases/test-fixtures";

describe("CancelAppointmentSeriesUseCase", () => {
  const educatorId = Uuid.random();
  const student = makeStudent(educatorId);

  let appointmentRepository: ReturnType<typeof makeAppointmentRepositoryFake>;
  let seriesRepository: ReturnType<typeof makeAppointmentSeriesRepositoryFake>;
  let scheduler: ReturnType<typeof makeSchedulerMock>;
  let useCase: CancelAppointmentSeriesUseCase;
  let series: AppointmentSeries;
  let occurrences: Appointment[];

  const stored = (appointment: Appointment) => appointmentRepository.store.get(appointment.id.value)!;

  const buildUseCase = (shares: ReturnType<typeof shareStudent>[] = []) =>
    new CancelAppointmentSeriesUseCase(
      appointmentRepository,
      seriesRepository,
      scheduler,
      makeStudentAccess(makeStudentRepositoryFake([student]), shares)
    );

  beforeEach(() => {
    appointmentRepository = makeAppointmentRepositoryFake();
    seriesRepository = makeAppointmentSeriesRepositoryFake();
    scheduler = makeSchedulerMock();
    useCase = buildUseCase();

    const seeded = seedSeries(
      { appointments: appointmentRepository, series: seriesRepository },
      {
        educatorId,
        studentId: student.id,
        firstScheduledAt: atTimeInSaoPaulo(addDays(todayInSaoPaulo(), 1), "14:00:00.000"),
        occurrences: 8,
      }
    );
    series = seeded.series;
    occurrences = seeded.appointments;
  });

  const request = (
    overrides: Partial<Parameters<CancelAppointmentSeriesUseCase["execute"]>[0]> = {}
  ) => ({
    educatorId,
    seriesId: series.id.value,
    fromAppointmentId: occurrences[3].id.value,
    ...overrides,
  });

  // BE-RC-02 e RC-06
  it("should cancel from the 4th occurrence on, keep the first 3 and end the series", async () => {
    const result = await useCase.execute(request());

    if (!result.ok) throw new Error(`unexpected failure: ${JSON.stringify(result.error)}`);
    for (const occurrence of occurrences.slice(0, 3)) {
      expect(stored(occurrence).status).toBe(AppointmentStatus.PENDING);
    }
    for (const occurrence of occurrences.slice(3)) {
      expect(stored(occurrence).status).toBe(AppointmentStatus.CANCELLED);
    }

    expect(result.value.created.map((appointment) => appointment.id.value)).toEqual(
      occurrences.slice(3).map((appointment) => appointment.id.value)
    );
    expect(result.value.skipped).toEqual([]);
    expect(result.value.series.isEnded).toBe(true);
    expect(result.value.series.endedAt).toBeInstanceOf(Date);
    expect(seriesRepository.store.get(series.id.value)!.isEnded).toBe(true);
  });

  it("should not touch completed or already cancelled occurrences after the indicated one", async () => {
    const completed = occurrences[5].changeStatus(AppointmentStatus.COMPLETED);
    if (!completed.ok) throw new Error(completed.error);
    appointmentRepository.store.set(completed.value.id.value, completed.value);
    const cancelledBefore = occurrences[6].cancel();
    appointmentRepository.store.set(cancelledBefore.id.value, cancelledBefore);

    const result = await useCase.execute(request());

    if (!result.ok) throw new Error("unexpected failure");
    expect(stored(occurrences[5]).status).toBe(AppointmentStatus.COMPLETED);
    expect(stored(occurrences[6])).toBe(cancelledBefore);
    expect(result.value.created.map((appointment) => appointment.id.value)).toEqual([
      occurrences[3].id.value,
      occurrences[4].id.value,
      occurrences[7].id.value,
    ]);
  });

  it("should cancel only upcoming occurrences when the series started weeks ago, even from a past one", async () => {
    // Série que começou há 6 semanas: 6 ocorrências passadas, ainda PENDING.
    const started = seedSeries(
      { appointments: appointmentRepository, series: seriesRepository },
      {
        educatorId,
        studentId: student.id,
        firstScheduledAt: atTimeInSaoPaulo(addDays(todayInSaoPaulo(), -42), "14:00:00.000"),
        occurrences: 10,
      }
    );
    const now = new Date();
    const past = started.appointments.filter((appointment) => appointment.scheduledAt <= now);
    const upcoming = started.appointments.filter((appointment) => appointment.scheduledAt > now);

    const result = await useCase.execute(
      request({ seriesId: started.series.id.value, fromAppointmentId: started.appointments[1].id.value })
    );

    if (!result.ok) throw new Error("unexpected failure");
    for (const appointment of past) {
      expect(stored(appointment)).toBe(appointment);
      expect(stored(appointment).status).toBe(AppointmentStatus.PENDING);
    }
    for (const appointment of upcoming) {
      expect(stored(appointment).status).toBe(AppointmentStatus.CANCELLED);
    }
    expect(result.value.created.map((appointment) => appointment.id.value)).toEqual(
      upcoming.map((appointment) => appointment.id.value)
    );
    expect(result.value.series.isEnded).toBe(true);
  });

  it("should save every occurrence as CANCELLED before touching the reminder chain", async () => {
    const leader = occurrences[3].withMetadata("qstashMessageId", "msg-leader");
    appointmentRepository.store.set(leader.id.value, leader);
    const order: string[] = [];
    appointmentRepository.save.mockImplementation(async (appointment: Appointment) => {
      order.push(`save:${appointment.status}`);
      appointmentRepository.store.set(appointment.id.value, appointment);
    });
    scheduler.cancel.mockImplementation(async (appointment: Appointment) => {
      order.push(`cancel:${appointment.status}`);
    });

    await useCase.execute(request());

    expect(order.slice(0, 5)).toEqual(Array(5).fill("save:CANCELLED"));
    expect(order.slice(5)).toEqual(Array(5).fill("cancel:CANCELLED"));
    const cancelledLeader = scheduler.cancel.mock.calls.find(
      ([appointment]) => appointment.id.value === leader.id.value
    );
    expect(cancelledLeader?.[0].metadata["qstashMessageId"]).toBe("msg-leader");
  });

  it("should return APPOINTMENT_NOT_IN_SERIES for an appointment out of the series", async () => {
    const other = Appointment.create({
      educatorId,
      studentId: student.id,
      scheduledAt: occurrences[4].scheduledAt,
    });
    appointmentRepository.store.set(other.id.value, other);

    const result = await useCase.execute(request({ fromAppointmentId: other.id.value }));

    expect(result).toEqual({ ok: false, error: "APPOINTMENT_NOT_IN_SERIES" });
    expect(appointmentRepository.save).not.toHaveBeenCalled();
    expect(seriesRepository.save).not.toHaveBeenCalled();
  });

  it("should return SERIES_NOT_FOUND for an unknown or invalid id", async () => {
    expect(await useCase.execute(request({ seriesId: Uuid.random().value }))).toEqual({
      ok: false,
      error: "SERIES_NOT_FOUND",
    });
    expect(await useCase.execute(request({ seriesId: "123" }))).toEqual({
      ok: false,
      error: "SERIES_NOT_FOUND",
    });
  });

  it("should return UNAUTHORIZED for an educator without access to the student", async () => {
    const result = await useCase.execute(request({ educatorId: Uuid.random() }));

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(appointmentRepository.save).not.toHaveBeenCalled();
  });

  it("should let the educator the student was shared with cancel the series", async () => {
    const colleagueId = Uuid.random();
    useCase = buildUseCase([shareStudent(student, colleagueId)]);

    const result = await useCase.execute(request({ educatorId: colleagueId }));

    expect(result.ok).toBe(true);
  });
});
