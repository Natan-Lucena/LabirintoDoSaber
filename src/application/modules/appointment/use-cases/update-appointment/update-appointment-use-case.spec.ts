import { describe, it, expect, vi, beforeEach } from "vitest";
import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { UpdateAppointmentUseCase } from "./update-appointment-use-case";
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
    observation: "Initial note",
    ...overrides,
  });

const futureDate = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

describe("UpdateAppointmentUseCase", () => {
  let appointmentRepository: AppointmentRepository;
  let schedulerService: AppointmentSchedulerService;
  let useCase: UpdateAppointmentUseCase;

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
    useCase = new UpdateAppointmentUseCase(
      appointmentRepository,
      schedulerService,
      makeStudentAccess(studentRepository, shareRepository)
    );

    (appointmentRepository.save as any).mockResolvedValue(undefined);
    (appointmentRepository.search as any).mockResolvedValue([]);
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
  it("should save the type and durationMinutes", async () => {
    const appt = makeAppointment(educatorId);
    (appointmentRepository.findById as any).mockResolvedValue(appt);

    await useCase.execute({ id: appt.id, educatorId, type: "Avaliação", durationMinutes: 90 });

    const savedArg = (appointmentRepository.save as any).mock.calls[0][0];
    expect(savedArg.type).toBe("Avaliação");
    expect(savedArg.durationMinutes).toBe(90);
  });

  describe("status", () => {
    it("PENDING -> CANCELLED should save before calling scheduler.cancel with the cancelled appointment", async () => {
      const appt = makeAppointment(educatorId);
      (appointmentRepository.findById as any).mockResolvedValue(appt);
      const callOrder: string[] = [];
      (appointmentRepository.save as any).mockImplementation(async () => {
        callOrder.push("save");
      });
      (schedulerService.cancel as any).mockImplementation(async () => {
        callOrder.push("cancel");
      });

      const result = await useCase.execute({ id: appt.id, educatorId, status: AppointmentStatus.CANCELLED });

      expect(result.ok).toBe(true);
      expect(callOrder).toEqual(["save", "cancel"]);
      const cancelArg = (schedulerService.cancel as any).mock.calls[0][0];
      expect(cancelArg.id.value).toBe(appt.id.value);
      expect(cancelArg.status).toBe(AppointmentStatus.CANCELLED);
      expect(schedulerService.ensureScheduled).not.toHaveBeenCalled();
    });

    it("PENDING -> COMPLETED should call scheduler.cancel", async () => {
      const appt = makeAppointment(educatorId);
      (appointmentRepository.findById as any).mockResolvedValue(appt);

      await useCase.execute({ id: appt.id, educatorId, status: AppointmentStatus.COMPLETED });

      expect(schedulerService.cancel).toHaveBeenCalledOnce();
      const savedArg = (appointmentRepository.save as any).mock.calls[0][0];
      expect(savedArg.status).toBe(AppointmentStatus.COMPLETED);
    });

    it("CANCELLED -> PENDING in the future should call scheduler.ensureScheduled", async () => {
      const appt = makeAppointment(educatorId, {
        status: AppointmentStatus.CANCELLED,
        scheduledAt: futureDate(),
      });
      (appointmentRepository.findById as any).mockResolvedValue(appt);

      const result = await useCase.execute({ id: appt.id, educatorId, status: AppointmentStatus.PENDING });

      expect(result.ok).toBe(true);
      expect(schedulerService.ensureScheduled).toHaveBeenCalledOnce();
      const arg = (schedulerService.ensureScheduled as any).mock.calls[0][0];
      expect(arg.status).toBe(AppointmentStatus.PENDING);
      expect(schedulerService.cancel).not.toHaveBeenCalled();
    });

    it("CANCELLED -> PENDING in the past should not call ensureScheduled", async () => {
      const appt = makeAppointment(educatorId, {
        status: AppointmentStatus.CANCELLED,
        scheduledAt: new Date("2020-01-01T10:00:00Z"),
      });
      (appointmentRepository.findById as any).mockResolvedValue(appt);

      const result = await useCase.execute({ id: appt.id, educatorId, status: AppointmentStatus.PENDING });

      expect(result.ok).toBe(true);
      expect(schedulerService.ensureScheduled).not.toHaveBeenCalled();
    });

    it("should allow reactivating and rescheduling in the same request", async () => {
      const appt = makeAppointment(educatorId, { status: AppointmentStatus.CANCELLED });
      (appointmentRepository.findById as any).mockResolvedValue(appt);
      const newDate = futureDate();

      const result = await useCase.execute({
        id: appt.id,
        educatorId,
        status: AppointmentStatus.PENDING,
        scheduledAt: newDate,
        durationMinutes: 30,
      });

      expect(result.ok).toBe(true);
      const savedArg = (appointmentRepository.save as any).mock.calls[0][0];
      expect(savedArg.status).toBe(AppointmentStatus.PENDING);
      expect(savedArg.scheduledAt).toEqual(newDate);
      expect(savedArg.durationMinutes).toBe(30);
      expect(appointmentRepository.search).toHaveBeenCalledOnce();
      expect(schedulerService.ensureScheduled).toHaveBeenCalledOnce();
    });

    it("should return APPOINTMENT_CONFLICT when reactivating into an occupied new slot", async () => {
      const appt = makeAppointment(educatorId, { status: AppointmentStatus.CANCELLED });
      const newDate = new Date("2026-09-01T10:00:00Z");
      const other = makeAppointment(educatorId, { scheduledAt: new Date("2026-09-01T10:20:00Z") });
      (appointmentRepository.findById as any).mockResolvedValue(appt);
      (appointmentRepository.search as any).mockResolvedValue([other]);

      const result = await useCase.execute({
        id: appt.id,
        educatorId,
        status: AppointmentStatus.PENDING,
        scheduledAt: newDate,
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "APPOINTMENT_CONFLICT", conflictingAppointmentId: other.id.value },
      });
      expect(appointmentRepository.save).not.toHaveBeenCalled();
    });

    it("COMPLETED -> PENDING should return INVALID_STATUS_TRANSITION without saving", async () => {
      const appt = makeAppointment(educatorId, { status: AppointmentStatus.COMPLETED });
      (appointmentRepository.findById as any).mockResolvedValue(appt);

      const result = await useCase.execute({ id: appt.id, educatorId, status: AppointmentStatus.PENDING });

      expect(result).toEqual({ ok: false, error: "INVALID_STATUS_TRANSITION" });
      expect(appointmentRepository.save).not.toHaveBeenCalled();
      expect(schedulerService.cancel).not.toHaveBeenCalled();
      expect(schedulerService.ensureScheduled).not.toHaveBeenCalled();
    });

    it("should not touch the reminder chain when status is unchanged", async () => {
      const appt = makeAppointment(educatorId);
      (appointmentRepository.findById as any).mockResolvedValue(appt);

      await useCase.execute({ id: appt.id, educatorId, observation: "x", status: AppointmentStatus.PENDING });

      expect(schedulerService.cancel).not.toHaveBeenCalled();
      expect(schedulerService.ensureScheduled).not.toHaveBeenCalled();
    });
  });

  it("should return APPOINTMENT_NOT_EDITABLE when rescheduling a CANCELLED appointment", async () => {
    const appt = makeAppointment(educatorId, { status: AppointmentStatus.CANCELLED });
    (appointmentRepository.findById as any).mockResolvedValue(appt);

    const result = await useCase.execute({
      id: appt.id,
      educatorId,
      scheduledAt: new Date("2026-09-01T10:00:00Z"),
    });

    expect(result).toEqual({ ok: false, error: "APPOINTMENT_NOT_EDITABLE" });
    expect(appointmentRepository.save).not.toHaveBeenCalled();
  });

  describe("conflict", () => {
    it("should return APPOINTMENT_CONFLICT when the new time overlaps another PENDING appointment", async () => {
      const appt = makeAppointment(educatorId);
      const other = makeAppointment(educatorId, { scheduledAt: new Date("2026-09-01T10:30:00Z") });
      (appointmentRepository.findById as any).mockResolvedValue(appt);
      (appointmentRepository.search as any).mockResolvedValue([other]);

      const result = await useCase.execute({
        id: appt.id,
        educatorId,
        scheduledAt: new Date("2026-09-01T10:00:00Z"),
      });

      expect(result).toEqual({
        ok: false,
        error: { code: "APPOINTMENT_CONFLICT", conflictingAppointmentId: other.id.value },
      });
      expect(appointmentRepository.save).not.toHaveBeenCalled();
    });

    it("should ignore the appointment itself when checking for conflicts", async () => {
      const appt = makeAppointment(educatorId);
      (appointmentRepository.findById as any).mockResolvedValue(appt);
      (appointmentRepository.search as any).mockResolvedValue([appt]);

      const result = await useCase.execute({ id: appt.id, educatorId, durationMinutes: 60 });

      expect(result.ok).toBe(true);
    });

    it("should not check conflicts when only observation changes", async () => {
      const appt = makeAppointment(educatorId);
      (appointmentRepository.findById as any).mockResolvedValue(appt);

      await useCase.execute({ id: appt.id, educatorId, observation: "Nova" });

      expect(appointmentRepository.search).not.toHaveBeenCalled();
    });

    it("should return APPOINTMENT_CONFLICT when reactivating into an occupied slot", async () => {
      const appt = makeAppointment(educatorId, {
        status: AppointmentStatus.CANCELLED,
        scheduledAt: new Date("2026-09-01T10:00:00Z"),
      });
      const other = makeAppointment(educatorId, { scheduledAt: new Date("2026-09-01T10:00:00Z") });
      (appointmentRepository.findById as any).mockResolvedValue(appt);
      (appointmentRepository.search as any).mockResolvedValue([other]);

      const result = await useCase.execute({ id: appt.id, educatorId, status: AppointmentStatus.PENDING });

      expect(result).toEqual({
        ok: false,
        error: { code: "APPOINTMENT_CONFLICT", conflictingAppointmentId: other.id.value },
      });
      expect(schedulerService.ensureScheduled).not.toHaveBeenCalled();
    });
  });

  describe("paciente compartilhado (EQ-11)", () => {
    const ownerId = Uuid.random();
    const colleagueId = Uuid.random();
    const shared = makeStudent(ownerId);

    beforeEach(async () => {
      studentRepository.store.set(shared.id.value, shared);
    });

    it("lets the colleague update the owner's appointment of a shared student", async () => {
      await shareRepository.create(shareStudent(shared, colleagueId));
      const appt = makeAppointment(ownerId, { studentId: shared.id });
      (appointmentRepository.findById as any).mockResolvedValue(appt);

      const result = await useCase.execute({ id: appt.id, educatorId: colleagueId, observation: "Nota do colega" });

      expect(result.ok).toBe(true);
      expect(appointmentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ observation: "Nota do colega", educatorId: ownerId })
      );
    });

    it("returns NOT_FOUND for a colleague without the share", async () => {
      const appt = makeAppointment(ownerId, { studentId: shared.id });
      (appointmentRepository.findById as any).mockResolvedValue(appt);

      const result = await useCase.execute({ id: appt.id, educatorId: colleagueId, observation: "Nota do colega" });

      expect(result).toEqual(failure("NOT_FOUND"));
      expect(appointmentRepository.save).not.toHaveBeenCalled();
    });
  });

  describe("aluno arquivado (PA-04)", () => {
    const archivedStudentOf = (owner: Uuid) => {
      const studentId = ownStudentOf(owner);
      students.get(studentId.value)!.archive(new Date());
      return studentId;
    };

    it("reativar (status PENDING) um atendimento cancelado: STUDENT_ARCHIVED, sem gravar nem agendar", async () => {
      const appt = makeAppointment(educatorId, {
        studentId: archivedStudentOf(educatorId),
        status: AppointmentStatus.CANCELLED,
        scheduledAt: futureDate(),
      });
      (appointmentRepository.findById as any).mockResolvedValue(appt);

      const result = await useCase.execute({ id: appt.id, educatorId, status: AppointmentStatus.PENDING });

      expect(result).toEqual({ ok: false, error: "STUDENT_ARCHIVED" });
      expect(appointmentRepository.save).not.toHaveBeenCalled();
      expect(schedulerService.ensureScheduled).not.toHaveBeenCalled();
    });

    it("editar sem reativar continua permitido (o cancelado mantém a observação editável)", async () => {
      const appt = makeAppointment(educatorId, {
        studentId: archivedStudentOf(educatorId),
        status: AppointmentStatus.CANCELLED,
      });
      (appointmentRepository.findById as any).mockResolvedValue(appt);

      const result = await useCase.execute({ id: appt.id, educatorId, observation: "Nota" });

      expect(result.ok).toBe(true);
    });

    it("status PENDING num atendimento já PENDING não é reativação", async () => {
      const appt = makeAppointment(educatorId, { studentId: archivedStudentOf(educatorId) });
      (appointmentRepository.findById as any).mockResolvedValue(appt);

      const result = await useCase.execute({ id: appt.id, educatorId, status: AppointmentStatus.PENDING });

      expect(result.ok).toBe(true);
    });
  });
});
