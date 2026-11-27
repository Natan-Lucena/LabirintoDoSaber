import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { GetAppointmentSeriesUseCase } from "./get-appointment-series-use-case";
import { Appointment } from "../../../../../domain/entities/appointment";
import { AppointmentSeries } from "../../../../../domain/entities/appointment-series";
import {
  addDays,
  atTimeInSaoPaulo,
  todayInSaoPaulo,
} from "../../../../../domain/utils/date-only";
import {
  makeAppointmentRepositoryFake,
  makeAppointmentSeriesRepositoryFake,
  seedSeries,
} from "../../../../../domain/tests/fakes/appointment-fakes";
import {
  makeStudentAccess,
  makeStudentRepositoryFake,
  shareStudent,
} from "../../../../../domain/tests/fakes/student-share-fakes";
import { makeStudent } from "../../../session-evolution/use-cases/test-fixtures";

describe("GetAppointmentSeriesUseCase", () => {
  const educatorId = Uuid.random();
  const student = makeStudent(educatorId);

  let appointmentRepository: ReturnType<typeof makeAppointmentRepositoryFake>;
  let seriesRepository: ReturnType<typeof makeAppointmentSeriesRepositoryFake>;
  let series: AppointmentSeries;
  let occurrences: Appointment[];

  const buildUseCase = (shares: ReturnType<typeof shareStudent>[] = []) =>
    new GetAppointmentSeriesUseCase(
      appointmentRepository,
      seriesRepository,
      makeStudentAccess(makeStudentRepositoryFake([student]), shares)
    );

  beforeEach(() => {
    appointmentRepository = makeAppointmentRepositoryFake();
    seriesRepository = makeAppointmentSeriesRepositoryFake();

    const seeded = seedSeries(
      { appointments: appointmentRepository, series: seriesRepository },
      {
        educatorId,
        studentId: student.id,
        firstScheduledAt: atTimeInSaoPaulo(addDays(todayInSaoPaulo(), 1), "14:00:00.000"),
        occurrences: 4,
      }
    );
    series = seeded.series;
    occurrences = seeded.appointments;

    // Atendimento avulso do mesmo aluno: fora da série.
    const single = Appointment.create({
      educatorId,
      studentId: student.id,
      scheduledAt: atTimeInSaoPaulo(addDays(todayInSaoPaulo(), 2), "10:00:00.000"),
    });
    appointmentRepository.store.set(single.id.value, single);
  });

  it("should return the series with its appointments ordered by date", async () => {
    const result = await buildUseCase().execute({ educatorId, seriesId: series.id.value });

    if (!result.ok) throw new Error("unexpected failure");
    expect(result.value.series).toBe(series);
    expect(result.value.appointments.map((appointment) => appointment.id.value)).toEqual(
      occurrences.map((appointment) => appointment.id.value)
    );
  });

  it("should let the educator the student was shared with read the series", async () => {
    const colleagueId = Uuid.random();

    const result = await buildUseCase([shareStudent(student, colleagueId)]).execute({
      educatorId: colleagueId,
      seriesId: series.id.value,
    });

    expect(result.ok).toBe(true);
  });

  it("should return UNAUTHORIZED for an educator without access to the student", async () => {
    const result = await buildUseCase().execute({
      educatorId: Uuid.random(),
      seriesId: series.id.value,
    });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
  });

  it("should return SERIES_NOT_FOUND for an unknown or invalid id", async () => {
    const useCase = buildUseCase();

    expect(await useCase.execute({ educatorId, seriesId: Uuid.random().value })).toEqual({
      ok: false,
      error: "SERIES_NOT_FOUND",
    });
    expect(await useCase.execute({ educatorId, seriesId: "abc" })).toEqual({
      ok: false,
      error: "SERIES_NOT_FOUND",
    });
  });
});
