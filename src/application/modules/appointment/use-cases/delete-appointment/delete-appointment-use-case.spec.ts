import { describe, it, expect, vi, beforeEach } from "vitest";
import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { DeleteAppointmentUseCase } from "./delete-appointment-use-case";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { AppointmentSchedulerService } from "../../../../../domain/services/appointment-scheduler-service";
import { Appointment, AppointmentStatus } from "../../../../../domain/entities/appointment";

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

const makeAppointment = (educatorId: Uuid) =>
  Appointment.create({
    educatorId,
    studentId: Uuid.random(),
    scheduledAt: new Date("2026-08-01T10:00:00Z"),
  });

describe("DeleteAppointmentUseCase", () => {
  let appointmentRepository: AppointmentRepository;
  let schedulerService: AppointmentSchedulerService;
  let useCase: DeleteAppointmentUseCase;

  const educatorId = Uuid.random();

  beforeEach(() => {
    vi.restoreAllMocks();
    appointmentRepository = mockAppointmentRepository();
    schedulerService = mockSchedulerService();
    useCase = new DeleteAppointmentUseCase(appointmentRepository, schedulerService);

    (schedulerService.cancel as any).mockResolvedValue(undefined);
    (appointmentRepository.delete as any).mockResolvedValue(undefined);
  });

  it("should delete successfully and return success(undefined)", async () => {
    const appt = makeAppointment(educatorId);
    (appointmentRepository.findById as any).mockResolvedValue(appt);

    const result = await useCase.execute({ id: appt.id, educatorId });

    expect(result).toEqual(success(undefined));
  });

  it("should call schedulerService.cancel before repo.delete", async () => {
    const appt = makeAppointment(educatorId);
    (appointmentRepository.findById as any).mockResolvedValue(appt);

    const callOrder: string[] = [];
    (schedulerService.cancel as any).mockImplementation(async () => {
      callOrder.push("cancel");
    });
    (appointmentRepository.delete as any).mockImplementation(async () => {
      callOrder.push("delete");
    });

    await useCase.execute({ id: appt.id, educatorId });

    expect(callOrder).toEqual(["cancel", "delete"]);
  });

  it("should call repo.delete with the appointment id", async () => {
    const appt = makeAppointment(educatorId);
    (appointmentRepository.findById as any).mockResolvedValue(appt);

    await useCase.execute({ id: appt.id, educatorId });

    expect(appointmentRepository.delete).toHaveBeenCalledWith(appt.id);
  });

  it("should call schedulerService.cancel with the appointment", async () => {
    const appt = makeAppointment(educatorId);
    (appointmentRepository.findById as any).mockResolvedValue(appt);

    await useCase.execute({ id: appt.id, educatorId });

    expect(schedulerService.cancel).toHaveBeenCalledWith(appt);
  });

  it("should return failure('NOT_FOUND') when appointment does not exist", async () => {
    (appointmentRepository.findById as any).mockResolvedValue(null);

    const result = await useCase.execute({ id: Uuid.random(), educatorId });

    expect(result).toEqual(failure("NOT_FOUND"));
    expect(schedulerService.cancel).not.toHaveBeenCalled();
    expect(appointmentRepository.delete).not.toHaveBeenCalled();
  });

  it("should return failure('NOT_FOUND') when educatorId does not match", async () => {
    const differentEducatorId = Uuid.random();
    const appt = makeAppointment(differentEducatorId);
    (appointmentRepository.findById as any).mockResolvedValue(appt);

    const result = await useCase.execute({ id: appt.id, educatorId });

    expect(result).toEqual(failure("NOT_FOUND"));
    expect(schedulerService.cancel).not.toHaveBeenCalled();
    expect(appointmentRepository.delete).not.toHaveBeenCalled();
  });

  it("should not delete when appointment belongs to a different educator", async () => {
    const appt = makeAppointment(Uuid.random());
    (appointmentRepository.findById as any).mockResolvedValue(appt);

    await useCase.execute({ id: appt.id, educatorId });

    expect(appointmentRepository.delete).not.toHaveBeenCalled();
  });
});
