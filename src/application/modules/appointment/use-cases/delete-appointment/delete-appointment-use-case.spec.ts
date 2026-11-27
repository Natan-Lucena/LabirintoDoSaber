import { describe, it, expect, vi, beforeEach } from "vitest";
import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { DeleteAppointmentUseCase } from "./delete-appointment-use-case";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { AppointmentSchedulerService } from "../../../../../domain/services/appointment-scheduler-service";
import { Appointment, AppointmentStatus } from "../../../../../domain/entities/appointment";
import {
  makeShareRepository,
  makeStudentAccess,
  makeStudentRepositoryFake,
  shareStudent,
} from "../../../../../domain/tests/fakes/student-share-fakes";
import { makeStudent } from "../../../session-evolution/use-cases/test-fixtures";
import { Student } from "../../../../../domain/entities/student";

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
    reschedule: vi.fn(),
    cancel: vi.fn(),
    scheduleNext: vi.fn(),
  } as unknown as AppointmentSchedulerService);

// Alunos do repositório em memória do teste atual: o atendimento padrão é de
// um aluno do próprio educador, que ele acessa.
let students = new Map<string, Student>();
const ownStudentOf = (educatorId: Uuid) => {
  const student = makeStudent(educatorId);
  students.set(student.id.value, student);
  return student.id;
};

const makeAppointment = (
  educatorId: Uuid,
  overrides: Partial<Parameters<typeof Appointment.create>[0]> = {}
) =>
  Appointment.create({
    educatorId,
    studentId: overrides.studentId ?? ownStudentOf(educatorId),
    scheduledAt: new Date("2026-08-01T10:00:00Z"),
    ...overrides,
  });

describe("DeleteAppointmentUseCase", () => {
  let appointmentRepository: AppointmentRepository;
  let schedulerService: AppointmentSchedulerService;
  let useCase: DeleteAppointmentUseCase;

  const educatorId = Uuid.random();
  let studentRepository: ReturnType<typeof makeStudentRepositoryFake>;
  let shareRepository: ReturnType<typeof makeShareRepository>;

  beforeEach(() => {
    vi.restoreAllMocks();
    appointmentRepository = mockAppointmentRepository();
    schedulerService = mockSchedulerService();
    studentRepository = makeStudentRepositoryFake();
    students = studentRepository.store;
    shareRepository = makeShareRepository();
    useCase = new DeleteAppointmentUseCase(
      appointmentRepository,
      schedulerService,
      makeStudentAccess(studentRepository, shareRepository)
    );

    (schedulerService.cancel as any).mockResolvedValue(undefined);
    (appointmentRepository.delete as any).mockResolvedValue(undefined);
    (appointmentRepository.save as any).mockResolvedValue(undefined);
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

    const cancelArg = (schedulerService.cancel as any).mock.calls[0][0];
    expect(cancelArg.id.value).toBe(appt.id.value);
    expect(cancelArg.status).toBe(AppointmentStatus.CANCELLED);
  });

  it("should save the appointment as CANCELLED before calling schedulerService.cancel", async () => {
    const appt = makeAppointment(educatorId);
    (appointmentRepository.findById as any).mockResolvedValue(appt);

    const callOrder: string[] = [];
    (appointmentRepository.save as any).mockImplementation(async (saved: Appointment) => {
      callOrder.push(`save:${saved.status}`);
    });
    (schedulerService.cancel as any).mockImplementation(async () => {
      callOrder.push("cancel");
    });

    await useCase.execute({ id: appt.id, educatorId });

    expect(callOrder).toEqual([`save:${AppointmentStatus.CANCELLED}`, "cancel"]);
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

  describe("paciente compartilhado (EQ-11)", () => {
    const ownerId = Uuid.random();
    const colleagueId = Uuid.random();
    const shared = makeStudent(ownerId);

    beforeEach(async () => {
      studentRepository.store.set(shared.id.value, shared);
    });

    it("lets the colleague delete the owner's appointment of a shared student", async () => {
      await shareRepository.create(shareStudent(shared, colleagueId));
      const appt = makeAppointment(ownerId, { studentId: shared.id });
      (appointmentRepository.findById as any).mockResolvedValue(appt);

      const result = await useCase.execute({ id: appt.id, educatorId: colleagueId });

      expect(result.ok).toBe(true);
      expect(appointmentRepository.delete).toHaveBeenCalledWith(appt.id);
    });

    it("returns NOT_FOUND for a colleague without the share", async () => {
      const appt = makeAppointment(ownerId, { studentId: shared.id });
      (appointmentRepository.findById as any).mockResolvedValue(appt);

      const result = await useCase.execute({ id: appt.id, educatorId: colleagueId });

      expect(result).toEqual(failure("NOT_FOUND"));
      expect(appointmentRepository.delete).not.toHaveBeenCalled();
    });
  });
});
