// Atendimentos e séries em memória para os specs. A busca respeita os mesmos
// filtros e a mesma ordem (scheduledAt, id) do repositório Prisma.
import { vi } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { Appointment, AppointmentStatus } from "../../entities/appointment";
import { AppointmentSeries, RecurrenceFrequency } from "../../entities/appointment-series";
import {
  AppointmentRepository,
  SearchAppointmentParams,
} from "../../repositories/appointment-repository";
import { AppointmentSeriesRepository } from "../../repositories/appointment-series-repository";
import { AppointmentSchedulerService } from "../../services/appointment-scheduler-service";

export const makeAppointmentRepositoryFake = (initial: Appointment[] = []) => {
  const store = new Map(initial.map((appointment) => [appointment.id.value, appointment]));

  const matches = (appointment: Appointment, params: SearchAppointmentParams) =>
    (!params.educatorId || appointment.educatorId.value === params.educatorId.value) &&
    (!params.studentId || appointment.studentId.value === params.studentId.value) &&
    (!params.seriesId || appointment.seriesId?.value === params.seriesId.value) &&
    (!params.status || appointment.status === params.status) &&
    (!params.scheduledAfter || appointment.scheduledAt >= params.scheduledAfter) &&
    (!params.scheduledBefore || appointment.scheduledAt <= params.scheduledBefore);

  const repository = {
    store,
    save: vi.fn(async (appointment: Appointment) => {
      store.set(appointment.id.value, appointment);
    }),
    findById: vi.fn(async (id: Uuid) => store.get(id.value) ?? null),
    search: vi.fn(async (params: SearchAppointmentParams) =>
      [...store.values()]
        .filter((appointment) => matches(appointment, params))
        .sort(
          (a, b) =>
            a.scheduledAt.getTime() - b.scheduledAt.getTime() ||
            a.id.value.localeCompare(b.id.value)
        )
        .slice(0, params.limit)
    ),
    delete: vi.fn(async (id: Uuid) => {
      store.delete(id.value);
    }),
    findNextPendingByStudentIds: vi.fn(async (studentIds: Uuid[], after: Date) => {
      const ids = new Set(studentIds.map((id) => id.value));
      const next = new Map<string, Appointment>();
      for (const appointment of store.values()) {
        if (
          !ids.has(appointment.studentId.value) ||
          appointment.status !== AppointmentStatus.PENDING ||
          appointment.scheduledAt <= after
        ) {
          continue;
        }
        const current = next.get(appointment.studentId.value);
        if (!current || appointment.scheduledAt < current.scheduledAt) {
          next.set(appointment.studentId.value, appointment);
        }
      }
      return [...next.values()];
    }),
  };

  return repository satisfies AppointmentRepository;
};

export const makeAppointmentSeriesRepositoryFake = (initial: AppointmentSeries[] = []) => {
  const store = new Map(initial.map((series) => [series.id.value, series]));

  const repository = {
    store,
    save: vi.fn(async (series: AppointmentSeries) => {
      store.set(series.id.value, series);
    }),
    findById: vi.fn(async (id: Uuid) => store.get(id.value) ?? null),
  };

  return repository satisfies AppointmentSeriesRepository;
};

export const makeSchedulerMock = () => {
  const scheduler = {
    ensureScheduled: vi.fn(async (_appointment: Appointment) => {}),
    reschedule: vi.fn(async (_appointment: Appointment) => {}),
    cancel: vi.fn(async (_appointment: Appointment) => {}),
    scheduleNext: vi.fn(async () => {}),
  };
  return scheduler satisfies AppointmentSchedulerService;
};

// Série já criada, com as ocorrências gravadas nos repositórios em memória.
export const seedSeries = (
  repositories: {
    appointments: ReturnType<typeof makeAppointmentRepositoryFake>;
    series: ReturnType<typeof makeAppointmentSeriesRepositoryFake>;
  },
  props: {
    educatorId: Uuid;
    studentId: Uuid;
    firstScheduledAt: Date;
    occurrences: number;
    frequency?: RecurrenceFrequency;
  }
) => {
  const created = AppointmentSeries.create({
    ...props,
    frequency: props.frequency ?? RecurrenceFrequency.WEEKLY,
  });
  if (!created.ok) throw new Error(`invalid series: ${created.error}`);
  const series = created.value;

  const appointments = series.occurrenceDates().map((scheduledAt) =>
    Appointment.create({
      educatorId: series.educatorId,
      studentId: series.studentId,
      seriesId: series.id,
      scheduledAt,
      durationMinutes: series.durationMinutes,
    })
  );

  repositories.series.store.set(series.id.value, series);
  for (const appointment of appointments) {
    repositories.appointments.store.set(appointment.id.value, appointment);
  }

  return { series, appointments };
};
