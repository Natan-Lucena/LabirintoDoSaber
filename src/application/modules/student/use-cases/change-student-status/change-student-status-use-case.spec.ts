import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import {
  Appointment,
  AppointmentStatus,
} from "../../../../../domain/entities/appointment";
import {
  AppointmentRepository,
  SearchAppointmentParams,
} from "../../../../../domain/repositories/appointment-repository";
import { AppointmentSchedulerService } from "../../../../../domain/services/appointment-scheduler-service";
import { shareStudent } from "../../../../../domain/tests/fakes/student-share-fakes";
import { setupSharing } from "../test-fixtures";
import { ChangeStudentStatusUseCase } from "./change-student-status-use-case";

const NOW = new Date("2026-11-26T15:00:00.000Z");

const setup = () => {
  const ctx = setupSharing();
  const appointments: Appointment[] = [];
  const calls: string[] = [];

  // Aplica os mesmos filtros da consulta real.
  const appointmentRepository = {
    search: vi.fn(async (params: SearchAppointmentParams) =>
      appointments.filter(
        (a) =>
          (!params.studentId || a.studentId.value === params.studentId.value) &&
          (!params.status || a.status === params.status) &&
          (!params.scheduledAfter || a.scheduledAt >= params.scheduledAfter)
      )
    ),
    save: vi.fn(async (appointment: Appointment) => {
      calls.push(`save:${appointment.id.value}:${appointment.status}`);
    }),
    findById: vi.fn(),
    delete: vi.fn(),
    findNextPendingByStudentIds: vi.fn(),
  } satisfies AppointmentRepository;

  const schedulerService = {
    ensureScheduled: vi.fn(),
    reschedule: vi.fn(),
    cancel: vi.fn(async (appointment: Appointment) => {
      calls.push(`cancel:${appointment.id.value}:${appointment.status}`);
    }),
    scheduleNext: vi.fn(),
  } satisfies AppointmentSchedulerService;

  const useCase = new ChangeStudentStatusUseCase(
    ctx.studentAccess,
    ctx.studentRepository,
    appointmentRepository,
    schedulerService
  );

  const addAppointment = (scheduledAt: string, educatorId = ctx.owner.id, status = AppointmentStatus.PENDING) => {
    const appointment = Appointment.create({
      educatorId,
      studentId: ctx.student.id,
      scheduledAt: new Date(scheduledAt),
      status,
    });
    appointments.push(appointment);
    return appointment;
  };

  return { ...ctx, appointmentRepository, schedulerService, useCase, addAppointment, calls };
};

describe("ChangeStudentStatusUseCase", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("arquivar (PA-02)", () => {
    it("com atendimentos futuros PENDING e sem a opção: HAS_FUTURE_APPOINTMENTS com a contagem (BE-PA-01)", async () => {
      const { owner, colleague, student, useCase, addAppointment, studentRepository, appointmentRepository, schedulerService } = setup();
      addAppointment("2026-11-27T13:00:00.000Z");
      // De um colega com quem o aluno é compartilhado: também conta.
      addAppointment("2026-12-03T13:00:00.000Z", colleague.id);
      // Passado, concluído e cancelado não contam.
      addAppointment("2026-11-20T13:00:00.000Z");
      addAppointment("2026-11-28T13:00:00.000Z", owner.id, AppointmentStatus.COMPLETED);
      addAppointment("2026-11-29T13:00:00.000Z", owner.id, AppointmentStatus.CANCELLED);

      const result = await useCase.execute({
        educatorId: owner.id,
        studentId: student.id.value,
        status: "ARCHIVED",
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "HAS_FUTURE_APPOINTMENTS", count: 2 },
      });
      expect(appointmentRepository.search).toHaveBeenCalledWith({
        studentId: student.id,
        status: AppointmentStatus.PENDING,
        scheduledAfter: NOW,
      });
      expect(student.status).toBe("ACTIVE");
      expect(studentRepository.save).not.toHaveBeenCalled();
      expect(appointmentRepository.save).not.toHaveBeenCalled();
      expect(schedulerService.cancel).not.toHaveBeenCalled();
    });

    it("cancelFutureAppointments false é o mesmo que sem a opção", async () => {
      const { owner, student, useCase, addAppointment } = setup();
      addAppointment("2026-11-27T13:00:00.000Z");

      const result = await useCase.execute({
        educatorId: owner.id,
        studentId: student.id.value,
        status: "ARCHIVED",
        cancelFutureAppointments: false,
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "HAS_FUTURE_APPOINTMENTS", count: 1 },
      });
    });

    it("com a opção: cancela os futuros, salvando todos antes de mexer na cadeia do QStash, e arquiva", async () => {
      const { owner, student, useCase, addAppointment, studentRepository, schedulerService, calls } = setup();
      const first = addAppointment("2026-11-27T13:00:00.000Z");
      const second = addAppointment("2026-12-03T13:00:00.000Z");
      const past = addAppointment("2026-11-20T13:00:00.000Z");

      const result = await useCase.execute({
        educatorId: owner.id,
        studentId: student.id.value,
        status: "ARCHIVED",
        cancelFutureAppointments: true,
      });

      expect(result.ok).toBe(true);
      expect(calls).toEqual([
        `save:${first.id.value}:CANCELLED`,
        `save:${second.id.value}:CANCELLED`,
        `cancel:${first.id.value}:CANCELLED`,
        `cancel:${second.id.value}:CANCELLED`,
      ]);
      expect(calls.some((call) => call.includes(past.id.value))).toBe(false);
      expect(schedulerService.cancel).toHaveBeenCalledTimes(2);
      expect(studentRepository.save).toHaveBeenCalledOnce();
      expect(student.status).toBe("ARCHIVED");
      expect(student.archivedAt).toEqual(NOW);
      if (result.ok) {
        expect(result.value).toMatchObject({
          id: student.id.value,
          status: "ARCHIVED",
          archivedAt: NOW,
          access: "OWNER",
        });
      }
    });

    it("sem atendimento futuro: arquiva sem precisar da opção", async () => {
      const { owner, student, useCase, studentRepository, schedulerService } = setup();

      const result = await useCase.execute({
        educatorId: owner.id,
        studentId: student.id.value,
        status: "ARCHIVED",
      });

      expect(result.ok).toBe(true);
      expect(student.status).toBe("ARCHIVED");
      expect(studentRepository.save).toHaveBeenCalledOnce();
      expect(schedulerService.cancel).not.toHaveBeenCalled();
    });

    it("já arquivado: devolve o aluno sem regravar", async () => {
      const { owner, student, useCase, studentRepository } = setup();
      const archivedAt = new Date("2026-11-01T10:00:00.000Z");
      student.archive(archivedAt);

      const result = await useCase.execute({
        educatorId: owner.id,
        studentId: student.id.value,
        status: "ARCHIVED",
      });

      expect(result.ok).toBe(true);
      expect(student.archivedAt).toEqual(archivedAt);
      expect(studentRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("reativar (PA-05)", () => {
    it("volta a ACTIVE sem recriar os atendimentos cancelados", async () => {
      const { owner, student, useCase, addAppointment, studentRepository, appointmentRepository, schedulerService } = setup();
      student.archive(new Date("2026-11-01T10:00:00.000Z"));
      addAppointment("2026-11-27T13:00:00.000Z", owner.id, AppointmentStatus.CANCELLED);

      const result = await useCase.execute({
        educatorId: owner.id,
        studentId: student.id.value,
        status: "ACTIVE",
      });

      expect(result.ok).toBe(true);
      expect(student.status).toBe("ACTIVE");
      expect(student.archivedAt).toBeUndefined();
      expect(studentRepository.save).toHaveBeenCalledOnce();
      expect(appointmentRepository.save).not.toHaveBeenCalled();
      expect(schedulerService.ensureScheduled).not.toHaveBeenCalled();
      if (result.ok) {
        expect(result.value.status).toBe("ACTIVE");
        expect(result.value).not.toHaveProperty("archivedAt");
      }
    });
  });

  describe("acesso", () => {
    it("só o dono: o compartilhado recebe UNAUTHORIZED", async () => {
      const { colleague, student, shareRepository, useCase, studentRepository } = setup();
      shareRepository.store.push(shareStudent(student, colleague.id));

      const result = await useCase.execute({
        educatorId: colleague.id,
        studentId: student.id.value,
        status: "ARCHIVED",
      });

      expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
      expect(studentRepository.save).not.toHaveBeenCalled();
    });

    it("educador sem acesso: UNAUTHORIZED", async () => {
      const { outsider, student, useCase } = setup();

      expect(
        await useCase.execute({ educatorId: outsider.id, studentId: student.id.value, status: "ARCHIVED" })
      ).toEqual({ ok: false, error: "UNAUTHORIZED" });
    });

    it("aluno inexistente ou id inválido: STUDENT_NOT_FOUND", async () => {
      const { owner, useCase } = setup();

      expect(
        await useCase.execute({ educatorId: owner.id, studentId: Uuid.random().value, status: "ARCHIVED" })
      ).toEqual({ ok: false, error: "STUDENT_NOT_FOUND" });
      expect(
        await useCase.execute({ educatorId: owner.id, studentId: "nao-e-uuid", status: "ARCHIVED" })
      ).toEqual({ ok: false, error: "STUDENT_NOT_FOUND" });
    });
  });
});
