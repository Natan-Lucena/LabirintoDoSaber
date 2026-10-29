import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskNotebookRepository } from "../../../../../domain/repositories/task-notebook-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { failure, Uuid } from "@wave-telecom/framework/core";
import { TaskNotebookSession } from "../../../../../domain/entities/task-notebook-session";
import { StartTaskNotebookSessionUseCase } from "./start-task-session-use-case";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { Appointment } from "../../../../../domain/entities/appointment";

const mockNotebookRepository = (): TaskNotebookRepository =>
  ({
    getById: vi.fn(),
  } as any);

const mockSessionRepository = (): TaskNotebookSessionRepository =>
  ({
    save: vi.fn(),
    getById: vi.fn(),
  } as any);

const mockStudentRepository = (): StudentRepository =>
  ({
    getById: vi.fn(),
  } as any);

const mockAppointmentRepository = (): AppointmentRepository =>
  ({
    findById: vi.fn(),
  } as any);

describe("StartTaskNotebookSessionUseCase", () => {
  let notebookRepo: TaskNotebookRepository;
  let sessionRepo: TaskNotebookSessionRepository;
  let studentRepo: StudentRepository;
  let appointmentRepo: AppointmentRepository;
  let useCase: StartTaskNotebookSessionUseCase;

  beforeEach(() => {
    vi.restoreAllMocks(); // <-- IMPORTANTE
    notebookRepo = mockNotebookRepository();
    sessionRepo = mockSessionRepository();
    studentRepo = mockStudentRepository();
    appointmentRepo = mockAppointmentRepository();
    useCase = new StartTaskNotebookSessionUseCase(
      notebookRepo,
      sessionRepo,
      studentRepo,
      appointmentRepo
    );
  });

  it("should fail if student is not found", async () => {
    (studentRepo.getById as any).mockResolvedValue(null);
    (notebookRepo.getById as any).mockResolvedValue({});

    const result = await useCase.execute({
      studentId: Uuid.random().value,
      name: Uuid.random().value,
      educatorId: Uuid.random(),
    });

    expect(result).toEqual(failure("STUDENT_NOT_FOUND"));
    expect(sessionRepo.save).not.toHaveBeenCalled();
  });

  it("should fail if session creation fails internally", async () => {
    (studentRepo.getById as any).mockResolvedValue({ id: Uuid.random() });
    (notebookRepo.getById as any).mockResolvedValue({ id: Uuid.random() });

    const spy = vi
      .spyOn(TaskNotebookSession, "start")
      .mockReturnValue(failure("ANY") as any);

    const result = await useCase.execute({
      studentId: Uuid.random().value,
      name: Uuid.random().value,
      educatorId: Uuid.random(),
    });

    spy.mockRestore();

    expect(result).toEqual(failure("SESSION_CREATION_FAILED"));
    expect(sessionRepo.save).not.toHaveBeenCalled();
  });

  it("should start a new session successfully", async () => {
    const studentId = Uuid.random();
    const notebookId = Uuid.random();

    (studentRepo.getById as any).mockResolvedValue({ id: studentId });
    (notebookRepo.getById as any).mockResolvedValue({ id: notebookId });

    const executeResult = await useCase.execute({
      studentId: studentId.value,
      name: notebookId.value,
      educatorId: Uuid.random(),
    });

    expect(executeResult.ok).toBe(true);

    expect(sessionRepo.save).toHaveBeenCalled();
    const savedSession = (sessionRepo.save as any).mock.calls[0][0];

    expect(savedSession).toBeTruthy();
    expect(savedSession.studentId).toEqual(studentId);
    expect(savedSession.name).toEqual(notebookId.value);
    expect(savedSession.answers.length).toBe(0);
    expect(savedSession.startedAt).toBeInstanceOf(Date);
  });

  describe("with notebook and appointment", () => {
    const educatorId = Uuid.random();
    const studentId = Uuid.random();

    const makeAppointment = (overrides: Partial<{ educatorId: Uuid; studentId: Uuid }> = {}) =>
      Appointment.create({
        educatorId: overrides.educatorId ?? educatorId,
        studentId: overrides.studentId ?? studentId,
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
      });

    beforeEach(() => {
      (studentRepo.getById as any).mockResolvedValue({ id: studentId });
    });

    it("should return NOTEBOOK_NOT_FOUND when the notebook does not exist", async () => {
      (notebookRepo.getById as any).mockResolvedValue(null);

      const result = await useCase.execute({
        studentId: studentId.value,
        name: "sessao",
        educatorId,
        taskNotebookId: Uuid.random().value,
      });

      expect(result).toEqual({ ok: false, error: "NOTEBOOK_NOT_FOUND" });
      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    it("should return NOTEBOOK_NOT_FOUND when the notebook belongs to another educator", async () => {
      (notebookRepo.getById as any).mockResolvedValue({
        id: Uuid.random(),
        educator: { id: Uuid.random() },
      });

      const result = await useCase.execute({
        studentId: studentId.value,
        name: "sessao",
        educatorId,
        taskNotebookId: Uuid.random().value,
      });

      expect(result).toEqual({ ok: false, error: "NOTEBOOK_NOT_FOUND" });
      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    it("should return APPOINTMENT_NOT_FOUND when the appointment does not exist", async () => {
      (appointmentRepo.findById as any).mockResolvedValue(null);

      const result = await useCase.execute({
        studentId: studentId.value,
        name: "sessao",
        educatorId,
        appointmentId: Uuid.random().value,
      });

      expect(result).toEqual({ ok: false, error: "APPOINTMENT_NOT_FOUND" });
      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    it("should return APPOINTMENT_NOT_FOUND when the appointment belongs to another student", async () => {
      const appointment = makeAppointment({ studentId: Uuid.random() });
      (appointmentRepo.findById as any).mockResolvedValue(appointment);

      const result = await useCase.execute({
        studentId: studentId.value,
        name: "sessao",
        educatorId,
        appointmentId: appointment.id.value,
      });

      expect(result).toEqual({ ok: false, error: "APPOINTMENT_NOT_FOUND" });
      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    it("should return APPOINTMENT_NOT_FOUND when the appointment belongs to another educator", async () => {
      const appointment = makeAppointment({ educatorId: Uuid.random() });
      (appointmentRepo.findById as any).mockResolvedValue(appointment);

      const result = await useCase.execute({
        studentId: studentId.value,
        name: "sessao",
        educatorId,
        appointmentId: appointment.id.value,
      });

      expect(result).toEqual({ ok: false, error: "APPOINTMENT_NOT_FOUND" });
      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    it("should store taskNotebookId and appointmentId in the session", async () => {
      const notebookId = Uuid.random();
      const appointment = makeAppointment();
      (notebookRepo.getById as any).mockResolvedValue({
        id: notebookId,
        educator: { id: new Uuid(educatorId.value) },
      });
      (appointmentRepo.findById as any).mockResolvedValue(appointment);

      const result = await useCase.execute({
        studentId: studentId.value,
        name: "sessao",
        educatorId,
        taskNotebookId: notebookId.value,
        appointmentId: appointment.id.value,
      });

      expect(result.ok).toBe(true);
      const saved = (sessionRepo.save as any).mock.calls[0][0] as TaskNotebookSession;
      expect(saved.taskNotebookId?.value).toBe(notebookId.value);
      expect(saved.appointmentId?.value).toBe(appointment.id.value);

      const json = JSON.parse(JSON.stringify(saved));
      expect(json.taskNotebookId).toBe(notebookId.value);
      expect(json.appointmentId).toBe(appointment.id.value);
    });

    it("should start a session without notebook nor appointment", async () => {
      const result = await useCase.execute({
        studentId: studentId.value,
        name: "sessao",
        educatorId,
      });

      expect(result.ok).toBe(true);
      expect(notebookRepo.getById).not.toHaveBeenCalled();
      expect(appointmentRepo.findById).not.toHaveBeenCalled();
      const saved = (sessionRepo.save as any).mock.calls[0][0] as TaskNotebookSession;
      expect(saved.taskNotebookId).toBeUndefined();
      expect(saved.appointmentId).toBeUndefined();
    });
  });
});
