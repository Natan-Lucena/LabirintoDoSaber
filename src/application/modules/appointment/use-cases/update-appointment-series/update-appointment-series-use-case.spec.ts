import { describe, it, expect, beforeEach, vi } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { UpdateAppointmentSeriesUseCase } from "./update-appointment-series-use-case";
import { Appointment, AppointmentStatus } from "../../../../../domain/entities/appointment";
import { AppointmentSeries } from "../../../../../domain/entities/appointment-series";
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
  seedSeries,
} from "../../../../../domain/tests/fakes/appointment-fakes";
import {
  makeStudentAccess,
  makeStudentRepositoryFake,
  shareStudent,
} from "../../../../../domain/tests/fakes/student-share-fakes";
import { makeStudent } from "../../../session-evolution/use-cases/test-fixtures";

const withStatus = (appointment: Appointment, status: AppointmentStatus) => {
  const result = appointment.changeStatus(status);
  if (!result.ok) throw new Error(result.error);
  return result.value;
};

describe("UpdateAppointmentSeriesUseCase", () => {
  const educatorId = Uuid.random();
  const student = makeStudent(educatorId);
  // Seis semanas, 14:00 em São Paulo: duas no passado e quatro no futuro.
  const firstDate = addDays(todayInSaoPaulo(), -13);

  let appointmentRepository: ReturnType<typeof makeAppointmentRepositoryFake>;
  let seriesRepository: ReturnType<typeof makeAppointmentSeriesRepositoryFake>;
  let scheduler: ReturnType<typeof makeSchedulerMock>;
  let useCase: UpdateAppointmentSeriesUseCase;
  let series: AppointmentSeries;
  let occurrences: Appointment[];

  const stored = (appointment: Appointment) => appointmentRepository.store.get(appointment.id.value)!;
  const replace = (appointment: Appointment) =>
    appointmentRepository.store.set(appointment.id.value, appointment);

  const buildUseCase = (shares: ReturnType<typeof shareStudent>[] = []) =>
    new UpdateAppointmentSeriesUseCase(
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
        firstScheduledAt: atTimeInSaoPaulo(firstDate, "14:00:00.000"),
        occurrences: 6,
      }
    );
    series = seeded.series;
    occurrences = seeded.appointments;

    // 1ª concluída, 2ª pendente no passado, 4ª cancelada.
    occurrences[0] = withStatus(occurrences[0], AppointmentStatus.COMPLETED);
    occurrences[3] = withStatus(occurrences[3], AppointmentStatus.CANCELLED);
    replace(occurrences[0]);
    replace(occurrences[3]);
  });

  const request = (
    overrides: Partial<Parameters<UpdateAppointmentSeriesUseCase["execute"]>[0]> = {}
  ) => ({
    educatorId,
    seriesId: series.id.value,
    fromAppointmentId: occurrences[2].id.value,
    ...overrides,
  });

  // RC-05
  it("should change this and the following PENDING occurrences, leaving past and cancelled ones alone", async () => {
    // Outro dia de propósito: só o horário conta.
    const newTime = atTimeInSaoPaulo(addDays(todayInSaoPaulo(), 3), "16:00:00.000");

    const result = await useCase.execute(
      request({ scheduledAt: newTime, durationMinutes: 45, type: "Avaliação", observation: "Sala 2" })
    );

    if (!result.ok) throw new Error(`unexpected failure: ${JSON.stringify(result.error)}`);
    expect(result.value.skipped).toEqual([]);
    expect(result.value.created.map((appointment) => appointment.id.value)).toEqual([
      occurrences[2].id.value,
      occurrences[4].id.value,
      occurrences[5].id.value,
    ]);

    for (const index of [2, 4, 5]) {
      const appointment = stored(occurrences[index]);
      expect(dateInSaoPaulo(appointment.scheduledAt)).toBe(addDays(firstDate, index * 7));
      expect(timeInSaoPaulo(appointment.scheduledAt)).toBe("16:00:00.000");
      expect(appointment.durationMinutes).toBe(45);
      expect(appointment.type).toBe("Avaliação");
      expect(appointment.observation).toBe("Sala 2");
      expect(appointment.status).toBe(AppointmentStatus.PENDING);
    }

    for (const index of [0, 1, 3]) {
      const appointment = stored(occurrences[index]);
      expect(appointment).toBe(occurrences[index]);
      expect(timeInSaoPaulo(appointment.scheduledAt)).toBe("14:00:00.000");
    }
    expect(appointmentRepository.save).toHaveBeenCalledTimes(3);
    expect(result.value.series).toBe(series);
  });

  it("should apply only the informed fields", async () => {
    const result = await useCase.execute(request({ observation: "Trazer o caderno" }));

    if (!result.ok) throw new Error("unexpected failure");
    for (const index of [2, 4, 5]) {
      const appointment = stored(occurrences[index]);
      expect(appointment.observation).toBe("Trazer o caderno");
      expect(appointment.scheduledAt).toEqual(occurrences[index].scheduledAt);
      expect(appointment.durationMinutes).toBe(occurrences[index].durationMinutes);
    }
  });

  it("should clear the observation when it is null", async () => {
    const withObservation = occurrences[4].update({ observation: "antiga" });
    if (!withObservation.ok) throw new Error(withObservation.error);
    replace(withObservation.value);

    const result = await useCase.execute(request({ observation: null }));

    if (!result.ok) throw new Error("unexpected failure");
    expect(stored(occurrences[4]).observation).toBeUndefined();
  });

  it("should keep a conflicting occurrence as it was and list it in skipped", async () => {
    const conflictDay = addDays(firstDate, 4 * 7);
    const conflicting = Appointment.create({
      educatorId,
      studentId: Uuid.random(),
      scheduledAt: atTimeInSaoPaulo(conflictDay, "16:30:00.000"),
    });
    replace(conflicting);

    const result = await useCase.execute(
      request({ scheduledAt: atTimeInSaoPaulo(todayInSaoPaulo(), "16:00:00.000") })
    );

    if (!result.ok) throw new Error("unexpected failure");
    expect(result.value.skipped).toEqual([
      {
        appointmentId: occurrences[4].id.value,
        scheduledAt: atTimeInSaoPaulo(conflictDay, "16:00:00.000"),
        reason: "CONFLICT",
        conflictingAppointmentId: conflicting.id.value,
      },
    ]);
    expect(stored(occurrences[4])).toBe(occurrences[4]);
    expect(timeInSaoPaulo(stored(occurrences[2]).scheduledAt)).toBe("16:00:00.000");
    expect(timeInSaoPaulo(stored(occurrences[5]).scheduledAt)).toBe("16:00:00.000");
    expect(result.value.created.map((appointment) => appointment.id.value)).toEqual([
      occurrences[2].id.value,
      occurrences[5].id.value,
    ]);
  });

  it("should not look for conflicts when neither the time nor the duration change", async () => {
    const conflicting = Appointment.create({
      educatorId,
      studentId: Uuid.random(),
      scheduledAt: occurrences[4].scheduledAt,
    });
    replace(conflicting);

    const result = await useCase.execute(request({ type: "Retorno" }));

    if (!result.ok) throw new Error("unexpected failure");
    expect(result.value.skipped).toEqual([]);
    expect(stored(occurrences[4]).type).toBe("Retorno");
  });

  it("should move the reminder chain when the leader changes time, saving before cancelling", async () => {
    const leader = occurrences[2].withMetadata("qstashMessageId", "msg-leader");
    replace(leader);
    const order: string[] = [];
    appointmentRepository.save.mockImplementation(async (appointment: Appointment) => {
      order.push("save");
      appointmentRepository.store.set(appointment.id.value, appointment);
    });
    scheduler.reschedule.mockImplementation(async () => {
      order.push("reschedule");
    });

    const result = await useCase.execute(
      request({ scheduledAt: atTimeInSaoPaulo(todayInSaoPaulo(), "09:00:00.000") })
    );

    if (!result.ok) throw new Error("unexpected failure");
    expect(scheduler.reschedule).toHaveBeenCalledOnce();
    const rescheduled = scheduler.reschedule.mock.calls[0][0];
    expect(rescheduled.id.value).toBe(leader.id.value);
    expect(timeInSaoPaulo(rescheduled.scheduledAt)).toBe("09:00:00.000");
    expect(rescheduled.metadata["qstashMessageId"]).toBe("msg-leader");
    expect(scheduler.cancel).not.toHaveBeenCalled();
    expect(order).toEqual(["save", "save", "save", "reschedule"]);
  });

  it("should leave the reminder chain alone when no time changes", async () => {
    replace(occurrences[2].withMetadata("qstashMessageId", "msg-leader"));

    await useCase.execute(request({ observation: "Sala 3" }));

    expect(scheduler.reschedule).not.toHaveBeenCalled();
    expect(scheduler.cancel).not.toHaveBeenCalled();
    expect(scheduler.ensureScheduled).not.toHaveBeenCalled();
  });

  it("should not touch the chain when only the duration changes", async () => {
    await useCase.execute(request({ durationMinutes: 30 }));

    expect(scheduler.reschedule).not.toHaveBeenCalled();
  });

  it("should return APPOINTMENT_NOT_EDITABLE when the new time of the indicated occurrence has passed", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      // Hoje às 10:00; a ocorrência é hoje às 18:00 e iria para as 08:00.
      vi.setSystemTime(atTimeInSaoPaulo("2026-12-01", "10:00:00.000"));
      const today = seedSeries(
        { appointments: appointmentRepository, series: seriesRepository },
        {
          educatorId,
          studentId: student.id,
          firstScheduledAt: atTimeInSaoPaulo("2026-12-01", "18:00:00.000"),
          occurrences: 3,
        }
      );

      const result = await useCase.execute({
        educatorId,
        seriesId: today.series.id.value,
        fromAppointmentId: today.appointments[0].id.value,
        scheduledAt: atTimeInSaoPaulo("2026-12-01", "08:00:00.000"),
      });

      expect(result).toEqual({ ok: false, error: "APPOINTMENT_NOT_EDITABLE" });
      expect(appointmentRepository.save).not.toHaveBeenCalled();
      expect(scheduler.reschedule).not.toHaveBeenCalled();
      for (const appointment of today.appointments) {
        expect(stored(appointment)).toBe(appointment);
      }
    } finally {
      vi.useRealTimers();
    }
  });

  it("should return APPOINTMENT_NOT_EDITABLE when the indicated occurrence is not PENDING", async () => {
    const result = await useCase.execute(
      request({ fromAppointmentId: occurrences[3].id.value, observation: "x" })
    );

    expect(result).toEqual({ ok: false, error: "APPOINTMENT_NOT_EDITABLE" });
    expect(appointmentRepository.save).not.toHaveBeenCalled();
  });

  it("should return APPOINTMENT_NOT_EDITABLE when the indicated occurrence is in the past", async () => {
    const result = await useCase.execute(
      request({ fromAppointmentId: occurrences[1].id.value, observation: "x" })
    );

    expect(result).toEqual({ ok: false, error: "APPOINTMENT_NOT_EDITABLE" });
    expect(appointmentRepository.save).not.toHaveBeenCalled();
  });

  it("should return APPOINTMENT_NOT_IN_SERIES for an appointment of another series or unknown", async () => {
    const other = Appointment.create({
      educatorId,
      studentId: student.id,
      scheduledAt: occurrences[4].scheduledAt,
    });
    replace(other);

    expect(await useCase.execute(request({ fromAppointmentId: other.id.value, type: "x" }))).toEqual({
      ok: false,
      error: "APPOINTMENT_NOT_IN_SERIES",
    });
    expect(
      await useCase.execute(request({ fromAppointmentId: Uuid.random().value, type: "x" }))
    ).toEqual({ ok: false, error: "APPOINTMENT_NOT_IN_SERIES" });
  });

  it("should return SERIES_NOT_FOUND for an unknown or invalid id", async () => {
    expect(await useCase.execute(request({ seriesId: Uuid.random().value, type: "x" }))).toEqual({
      ok: false,
      error: "SERIES_NOT_FOUND",
    });
    expect(await useCase.execute(request({ seriesId: "not-a-uuid", type: "x" }))).toEqual({
      ok: false,
      error: "SERIES_NOT_FOUND",
    });
  });

  it("should return UNAUTHORIZED for an educator without access to the student", async () => {
    const result = await useCase.execute(request({ educatorId: Uuid.random(), type: "x" }));

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
  });

  it("should let the educator the student was shared with edit the series", async () => {
    const colleagueId = Uuid.random();
    useCase = buildUseCase([shareStudent(student, colleagueId)]);

    const result = await useCase.execute(request({ educatorId: colleagueId, type: "Retorno" }));

    expect(result.ok).toBe(true);
  });
});
