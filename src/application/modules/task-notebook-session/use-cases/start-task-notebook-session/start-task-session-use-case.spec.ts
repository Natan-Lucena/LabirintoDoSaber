import { describe, it, expect, vi, beforeEach } from "vitest";
import { TaskNotebookRepository } from "../../../../../domain/repositories/task-notebook-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { failure, Uuid } from "@wave-telecom/framework/core";
import { TaskNotebookSession } from "../../../../../domain/entities/task-notebook-session";
import { StartTaskNotebookSessionUseCase } from "./start-task-session-use-case";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { Appointment } from "../../../../../domain/entities/appointment";
import { Student } from "../../../../../domain/entities/student";
import { makeStudent } from "../../../session-evolution/use-cases/test-fixtures";
import {
  makeShareRepository,
  makeStudentAccess,
  shareStudent,
} from "../../../../../domain/tests/fakes/student-share-fakes";

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
  let shareRepository: ReturnType<typeof makeShareRepository>;
  let useCase: StartTaskNotebookSessionUseCase;

  beforeEach(() => {
    vi.restoreAllMocks(); // <-- IMPORTANTE
    notebookRepo = mockNotebookRepository();
    sessionRepo = mockSessionRepository();
    studentRepo = mockStudentRepository();
    appointmentRepo = mockAppointmentRepository();
    shareRepository = makeShareRepository();
    useCase = new StartTaskNotebookSessionUseCase(
      notebookRepo,
      sessionRepo,
      makeStudentAccess(studentRepo, shareRepository),
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
    const educatorId = Uuid.random();
    const student = makeStudent(educatorId);
    (studentRepo.getById as any).mockResolvedValue(student);
    (notebookRepo.getById as any).mockResolvedValue({ id: Uuid.random() });

    const spy = vi
      .spyOn(TaskNotebookSession, "start")
      .mockReturnValue(failure("ANY") as any);

    const result = await useCase.execute({
      studentId: student.id.value,
      name: Uuid.random().value,
      educatorId,
    });

    spy.mockRestore();

    expect(result).toEqual(failure("SESSION_CREATION_FAILED"));
    expect(sessionRepo.save).not.toHaveBeenCalled();
  });

  it("should start a new session successfully", async () => {
    const educatorId = Uuid.random();
    const student = makeStudent(educatorId);
    const studentId = student.id;
    const notebookId = Uuid.random();

    (studentRepo.getById as any).mockResolvedValue(student);
    (notebookRepo.getById as any).mockResolvedValue({ id: notebookId });

    const executeResult = await useCase.execute({
      studentId: studentId.value,
      name: notebookId.value,
      educatorId,
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

  describe("access to the student (EQ-11)", () => {
    const ownerId = Uuid.random();
    let student: Student;

    beforeEach(() => {
      student = makeStudent(ownerId);
      (studentRepo.getById as any).mockResolvedValue(student);
    });

    it("should let an educator the student is shared with start a session", async () => {
      const colleagueId = Uuid.random();
      shareRepository.store.push(shareStudent(student, colleagueId));

      const result = await useCase.execute({
        studentId: student.id.value,
        name: "sessao",
        educatorId: colleagueId,
      });

      expect(result.ok).toBe(true);
      const saved = (sessionRepo.save as any).mock.calls[0][0] as TaskNotebookSession;
      // EQ-12: a sessão guarda quem conduziu.
      expect(saved.educatorId.value).toBe(colleagueId.value);
    });

    it("should return UNAUTHORIZED for an educator without access", async () => {
      const result = await useCase.execute({
        studentId: student.id.value,
        name: "sessao",
        educatorId: Uuid.random(),
      });

      expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
      expect(sessionRepo.save).not.toHaveBeenCalled();
    });

    it("should accept the owner's appointment of the student for a shared educator", async () => {
      const colleagueId = Uuid.random();
      shareRepository.store.push(shareStudent(student, colleagueId));
      const appointment = Appointment.create({
        educatorId: ownerId,
        studentId: student.id,
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
      });
      (appointmentRepo.findById as any).mockResolvedValue(appointment);

      const result = await useCase.execute({
        studentId: student.id.value,
        name: "sessao",
        educatorId: colleagueId,
        appointmentId: appointment.id.value,
      });

      expect(result.ok).toBe(true);
      const saved = (sessionRepo.save as any).mock.calls[0][0] as TaskNotebookSession;
      expect(saved.appointmentId?.value).toBe(appointment.id.value);
    });
  });

  describe("with notebook and appointment", () => {
    const educatorId = Uuid.random();
    const student = makeStudent(educatorId);
    const studentId = student.id;

    const makeAppointment = (overrides: Partial<{ educatorId: Uuid; studentId: Uuid }> = {}) =>
      Appointment.create({
        educatorId: overrides.educatorId ?? educatorId,
        studentId: overrides.studentId ?? studentId,
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000),
      });

    beforeEach(() => {
      (studentRepo.getById as any).mockResolvedValue(student);
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

  it("aluno arquivado: STUDENT_ARCHIVED, sem iniciar a sessão (PA-04)", async () => {
    const educatorId = Uuid.random();
    const archived = makeStudent(educatorId);
    archived.archive(new Date());
    (studentRepo.getById as any).mockResolvedValue(archived);

    const result = await useCase.execute({
      studentId: archived.id.value,
      name: "Sessão",
      educatorId,
    });

    expect(result).toEqual({ ok: false, error: "STUDENT_ARCHIVED" });
    expect(sessionRepo.save).not.toHaveBeenCalled();
  });
});
