import { describe, it, expect, vi, beforeEach } from "vitest";
import { FinishTaskNotebookSessionUseCase } from "./finish-task-notebook-session-use-case";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { success, failure, Uuid } from "@wave-telecom/framework/core";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { AppointmentSchedulerService } from "../../../../../domain/services/appointment-scheduler-service";
import {
  Appointment,
  AppointmentStatus,
} from "../../../../../domain/entities/appointment";
import { TaskNotebookSession } from "../../../../../domain/entities/task-notebook-session";

// Factory para criar uma sessão mockada
const makeSession = ({
  id = Uuid.random().value,
  finished = false,
  finishSuccess = true,
} = {}) => {
  const session = {
    id: new Uuid(id),
    finishedAt: finished ? new Date() : undefined,
    finish: vi.fn().mockImplementation(() => {
      if (!finishSuccess) return failure("ERROR");
      return success({
        ...session,
        finishedAt: new Date(),
      });
    }),
  };

  return session;
};

// Mock do repositório
const mockSessionRepository = (): TaskNotebookSessionRepository =>
  ({
    getById: vi.fn(),
    save: vi.fn(),
  } as unknown as TaskNotebookSessionRepository);

const mockAppointmentRepository = (): AppointmentRepository =>
  ({
    findById: vi.fn(),
    save: vi.fn(),
  } as unknown as AppointmentRepository);

const mockSchedulerService = (): AppointmentSchedulerService =>
  ({
    cancel: vi.fn(),
    ensureScheduled: vi.fn(),
    scheduleNext: vi.fn(),
  } as unknown as AppointmentSchedulerService);

describe("FinishTaskNotebookSessionUseCase", () => {
  let sessionRepository: TaskNotebookSessionRepository;
  let appointmentRepository: AppointmentRepository;
  let schedulerService: AppointmentSchedulerService;
  let useCase: FinishTaskNotebookSessionUseCase;

  beforeEach(() => {
    sessionRepository = mockSessionRepository();
    appointmentRepository = mockAppointmentRepository();
    schedulerService = mockSchedulerService();
    useCase = new FinishTaskNotebookSessionUseCase(
      sessionRepository,
      appointmentRepository,
      schedulerService
    );
  });

  it("should fail if session does not exist", async () => {
    (sessionRepository.getById as any).mockResolvedValue(null);

    const result = await useCase.execute({ sessionId: Uuid.random().value });

    expect(result).toEqual(failure("SESSION_NOT_FOUND"));
    expect(sessionRepository.save).not.toHaveBeenCalled();
  });

  it("should fail if session is already finished", async () => {
    const session = makeSession({ finished: true });
    (sessionRepository.getById as any).mockResolvedValue(session);

    const result = await useCase.execute({ sessionId: Uuid.random().value });

    expect(result).toEqual(failure("SESSION_ALREADY_FINISHED"));
    expect(session.finish).not.toHaveBeenCalled();
    expect(sessionRepository.save).not.toHaveBeenCalled();
  });

  it("should fail if finish() returns an error", async () => {
    const session = makeSession({ finishSuccess: false });
    (sessionRepository.getById as any).mockResolvedValue(session);

    const result = await useCase.execute({ sessionId: Uuid.random().value });

    expect(result).toEqual(failure("SESSION_FINISH_FAILED"));
    expect(session.finish).toHaveBeenCalled();
    expect(sessionRepository.save).not.toHaveBeenCalled();
  });

  it("should finish session successfully", async () => {
    const session = makeSession({});
    (sessionRepository.getById as any).mockResolvedValue(session);

    const result = await useCase.execute({ sessionId: Uuid.random().value });

    expect(session.finish).toHaveBeenCalled();
    expect(sessionRepository.save).toHaveBeenCalled();
    const saved = (sessionRepository.save as any).mock.calls[0][0];

    expect(saved.finishedAt).toBeDefined();
    expect(result).toEqual(success(saved));
  });

  describe("session started from an appointment", () => {
    const makeAppointment = (status: AppointmentStatus) =>
      Appointment.create({
        educatorId: Uuid.random(),
        studentId: Uuid.random(),
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
        status,
      });

    const makeLinkedSession = (appointmentId?: Uuid) =>
      new TaskNotebookSession(
        Uuid.random(),
        Uuid.random(),
        Uuid.random(),
        "sessao",
        new Date(),
        undefined,
        [],
        undefined,
        Uuid.random(),
        appointmentId
      );

    it("should save a PENDING appointment as COMPLETED and then cancel its reminder", async () => {
      const appointment = makeAppointment(AppointmentStatus.PENDING);
      const session = makeLinkedSession(appointment.id);
      (sessionRepository.getById as any).mockResolvedValue(session);
      (appointmentRepository.findById as any).mockResolvedValue(appointment);

      const order: string[] = [];
      (appointmentRepository.save as any).mockImplementation(async () => {
        order.push("save");
      });
      (schedulerService.cancel as any).mockImplementation(async () => {
        order.push("cancel");
      });

      const result = await useCase.execute({ sessionId: session.id.value });

      expect(result.ok).toBe(true);
      const findArg = (appointmentRepository.findById as any).mock.calls[0][0] as Uuid;
      expect(findArg.value).toBe(appointment.id.value);
      const saved = (appointmentRepository.save as any).mock.calls[0][0] as Appointment;
      expect(saved.id.value).toBe(appointment.id.value);
      expect(saved.status).toBe(AppointmentStatus.COMPLETED);
      const cancelArg = (schedulerService.cancel as any).mock.calls[0][0] as Appointment;
      expect(cancelArg.status).toBe(AppointmentStatus.COMPLETED);
      expect(order).toEqual(["save", "cancel"]);
    });

    it("should not change a CANCELLED appointment", async () => {
      const appointment = makeAppointment(AppointmentStatus.CANCELLED);
      const session = makeLinkedSession(appointment.id);
      (sessionRepository.getById as any).mockResolvedValue(session);
      (appointmentRepository.findById as any).mockResolvedValue(appointment);

      const result = await useCase.execute({ sessionId: session.id.value });

      expect(result.ok).toBe(true);
      expect(appointmentRepository.save).not.toHaveBeenCalled();
      expect(schedulerService.cancel).not.toHaveBeenCalled();
    });

    it("should still finish the session when completing the appointment fails", async () => {
      const appointment = makeAppointment(AppointmentStatus.PENDING);
      const session = makeLinkedSession(appointment.id);
      (sessionRepository.getById as any).mockResolvedValue(session);
      (appointmentRepository.findById as any).mockResolvedValue(appointment);
      (appointmentRepository.save as any).mockRejectedValue(new Error("db down"));
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await useCase.execute({ sessionId: session.id.value });

      expect(result.ok).toBe(true);
      expect(sessionRepository.save).toHaveBeenCalled();
      expect(schedulerService.cancel).not.toHaveBeenCalled();
      expect(errorSpy).toHaveBeenCalledWith(expect.any(String), {
        appointmentId: appointment.id.value,
        error: "Error",
      });
      errorSpy.mockRestore();
    });

    it("should not look up an appointment when the session has none", async () => {
      const session = makeLinkedSession();
      (sessionRepository.getById as any).mockResolvedValue(session);

      const result = await useCase.execute({ sessionId: session.id.value });

      expect(result.ok).toBe(true);
      expect(appointmentRepository.findById).not.toHaveBeenCalled();
    });

    it("should keep taskNotebookId and appointmentId in the finished session", async () => {
      const session = makeLinkedSession(Uuid.random());
      (sessionRepository.getById as any).mockResolvedValue(session);
      (appointmentRepository.findById as any).mockResolvedValue(null);

      await useCase.execute({ sessionId: session.id.value });

      const saved = (sessionRepository.save as any).mock.calls[0][0] as TaskNotebookSession;
      expect(saved.finishedAt).toBeInstanceOf(Date);
      expect(saved.taskNotebookId?.value).toBe(session.taskNotebookId?.value);
      expect(saved.appointmentId?.value).toBe(session.appointmentId?.value);
    });
  });
});
