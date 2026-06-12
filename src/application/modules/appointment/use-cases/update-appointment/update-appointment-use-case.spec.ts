import { describe, it, expect, vi, beforeEach } from "vitest";
import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { UpdateAppointmentUseCase } from "./update-appointment-use-case";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { Appointment } from "../../../../../domain/entities/appointment";

const mockAppointmentRepository = (): AppointmentRepository =>
  ({
    save: vi.fn(),
    findById: vi.fn(),
    delete: vi.fn(),
    search: vi.fn(),
  } as unknown as AppointmentRepository);

const makeAppointment = (educatorId: Uuid) =>
  Appointment.create({
    educatorId,
    studentId: Uuid.random(),
    scheduledAt: new Date("2026-08-01T10:00:00Z"),
    observation: "Initial note",
  });

describe("UpdateAppointmentUseCase", () => {
  let appointmentRepository: AppointmentRepository;
  let useCase: UpdateAppointmentUseCase;

  const educatorId = Uuid.random();

  beforeEach(() => {
    vi.restoreAllMocks();
    appointmentRepository = mockAppointmentRepository();
    useCase = new UpdateAppointmentUseCase(appointmentRepository);

    (appointmentRepository.save as any).mockResolvedValue(undefined);
  });

  it("should update and return success with appointment data", async () => {
    const appt = makeAppointment(educatorId);
    (appointmentRepository.findById as any).mockResolvedValue(appt);

    const newDate = new Date("2026-09-01T10:00:00Z");
    const result = await useCase.execute({
      id: appt.id,
      educatorId,
      scheduledAt: newDate,
    });

    expect(result.ok).toBe(true);
    expect(result).toEqual(
      success(expect.objectContaining({ scheduledAt: newDate }))
    );
  });

  it("should save the updated appointment", async () => {
    const appt = makeAppointment(educatorId);
    (appointmentRepository.findById as any).mockResolvedValue(appt);

    await useCase.execute({
      id: appt.id,
      educatorId,
      scheduledAt: new Date("2026-09-01T10:00:00Z"),
    });

    expect(appointmentRepository.save).toHaveBeenCalledOnce();
  });

  it("should pass the updated fields to repo.save", async () => {
    const appt = makeAppointment(educatorId);
    (appointmentRepository.findById as any).mockResolvedValue(appt);

    const newDate = new Date("2026-09-15T14:00:00Z");
    await useCase.execute({ id: appt.id, educatorId, scheduledAt: newDate });

    const savedArg = (appointmentRepository.save as any).mock.calls[0][0];
    expect(savedArg.scheduledAt).toEqual(newDate);
  });

  it("should update only observation when only observation is provided", async () => {
    const appt = makeAppointment(educatorId);
    (appointmentRepository.findById as any).mockResolvedValue(appt);

    await useCase.execute({ id: appt.id, educatorId, observation: "Updated note" });

    const savedArg = (appointmentRepository.save as any).mock.calls[0][0];
    expect(savedArg.observation).toBe("Updated note");
    expect(savedArg.scheduledAt).toEqual(appt.scheduledAt);
  });

  it("should allow clearing observation by passing null", async () => {
    const appt = makeAppointment(educatorId);
    (appointmentRepository.findById as any).mockResolvedValue(appt);

    await useCase.execute({ id: appt.id, educatorId, observation: null });

    const savedArg = (appointmentRepository.save as any).mock.calls[0][0];
    expect(savedArg.observation == null).toBe(true);
  });

  it("should return failure('NOT_FOUND') when appointment does not exist", async () => {
    (appointmentRepository.findById as any).mockResolvedValue(null);

    const result = await useCase.execute({
      id: Uuid.random(),
      educatorId,
      scheduledAt: new Date("2026-09-01T10:00:00Z"),
    });

    expect(result).toEqual(failure("NOT_FOUND"));
    expect(appointmentRepository.save).not.toHaveBeenCalled();
  });

  it("should return failure('NOT_FOUND') when educatorId does not match", async () => {
    const appt = makeAppointment(Uuid.random());
    (appointmentRepository.findById as any).mockResolvedValue(appt);

    const result = await useCase.execute({
      id: appt.id,
      educatorId,
      scheduledAt: new Date("2026-09-01T10:00:00Z"),
    });

    expect(result).toEqual(failure("NOT_FOUND"));
    expect(appointmentRepository.save).not.toHaveBeenCalled();
  });

  it("should not save when the educator does not own the appointment", async () => {
    const appt = makeAppointment(Uuid.random());
    (appointmentRepository.findById as any).mockResolvedValue(appt);

    await useCase.execute({ id: appt.id, educatorId });

    expect(appointmentRepository.save).not.toHaveBeenCalled();
  });

  it("should preserve other appointment fields on update", async () => {
    const appt = makeAppointment(educatorId);
    (appointmentRepository.findById as any).mockResolvedValue(appt);

    await useCase.execute({
      id: appt.id,
      educatorId,
      scheduledAt: new Date("2026-09-01T10:00:00Z"),
    });

    const savedArg = (appointmentRepository.save as any).mock.calls[0][0];
    expect(savedArg.educatorId).toBe(educatorId);
    expect(savedArg.studentId).toBe(appt.studentId);
    expect(savedArg.id).toBe(appt.id);
  });
});
