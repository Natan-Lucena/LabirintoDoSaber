import { describe, it, expect, vi, beforeEach } from "vitest";
import { success, Uuid } from "@wave-telecom/framework/core";
import { CreateAppointmentUseCase } from "./create-appointment-use-case";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { AppointmentSchedulerService } from "../../../../../domain/services/appointment-scheduler-service";

const mockAppointmentRepository = (): AppointmentRepository =>
  ({
    save: vi.fn(),
    findById: vi.fn(),
    delete: vi.fn(),
    search: vi.fn(),
  } as unknown as AppointmentRepository);

const mockSchedulerService = (): AppointmentSchedulerService =>
  ({
    ensureScheduled: vi.fn(),
    cancel: vi.fn(),
    scheduleNext: vi.fn(),
  } as unknown as AppointmentSchedulerService);

describe("CreateAppointmentUseCase", () => {
  let appointmentRepository: AppointmentRepository;
  let schedulerService: AppointmentSchedulerService;
  let useCase: CreateAppointmentUseCase;

  const educatorId = Uuid.random();
  const studentId = Uuid.random();
  const scheduledAt = new Date("2026-08-01T10:00:00Z");

  beforeEach(() => {
    vi.restoreAllMocks();
    appointmentRepository = mockAppointmentRepository();
    schedulerService = mockSchedulerService();
    useCase = new CreateAppointmentUseCase(appointmentRepository, schedulerService);

    (appointmentRepository.save as any).mockResolvedValue(undefined);
    (schedulerService.ensureScheduled as any).mockResolvedValue(undefined);
  });

  it("should create and save the appointment", async () => {
    const result = await useCase.execute({ educatorId, studentId, scheduledAt });

    expect(result.ok).toBe(true);
    expect(appointmentRepository.save).toHaveBeenCalledOnce();
  });

  it("should call schedulerService.ensureScheduled with the appointment", async () => {
    await useCase.execute({ educatorId, studentId, scheduledAt });

    expect(schedulerService.ensureScheduled).toHaveBeenCalledOnce();
    const savedArg = (schedulerService.ensureScheduled as any).mock.calls[0][0];
    expect(savedArg).toBeDefined();
  });

  it("should call save before ensureScheduled", async () => {
    const callOrder: string[] = [];
    (appointmentRepository.save as any).mockImplementation(async () => {
      callOrder.push("save");
    });
    (schedulerService.ensureScheduled as any).mockImplementation(async () => {
      callOrder.push("ensureScheduled");
    });

    await useCase.execute({ educatorId, studentId, scheduledAt });

    expect(callOrder).toEqual(["save", "ensureScheduled"]);
  });

  it("should return success with appointment data", async () => {
    const result = await useCase.execute({ educatorId, studentId, scheduledAt });

    expect(result).toEqual(success(expect.objectContaining({ educatorId, studentId })));
  });

  it("should forward the optional observation field", async () => {
    const observation = "Patient has allergies";

    await useCase.execute({ educatorId, studentId, scheduledAt, observation });

    const savedArg = (appointmentRepository.save as any).mock.calls[0][0];
    expect(savedArg.observation).toBe(observation);
  });

  it("should pass different educator/student ids correctly", async () => {
    const otherId = Uuid.random();
    await useCase.execute({ educatorId: otherId, studentId, scheduledAt });

    const savedArg = (appointmentRepository.save as any).mock.calls[0][0];
    expect(savedArg.educatorId).toBe(otherId);
  });
});
