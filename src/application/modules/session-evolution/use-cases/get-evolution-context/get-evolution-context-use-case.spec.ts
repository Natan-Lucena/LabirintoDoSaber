import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { GetEvolutionContextUseCase } from "./get-evolution-context-use-case";
import { GoalStatus, PlanStatus, PlanType } from "../../../../../domain/entities/plan";
import { SessionEvolution } from "../../../../../domain/entities/session-evolution";
import { TaskNotebookSession } from "../../../../../domain/entities/task-notebook-session";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import {
  makeShareRepository,
  makeStudentAccess,
  shareStudent,
} from "../../../../../domain/tests/fakes/student-share-fakes";
import { makeAnswer, makePdi, makePe, makeSession, makeStudent } from "../test-fixtures";
import { ActivityResult } from "../../../../../domain/entities/activity-result";
import { Task } from "../../../../../domain/entities/task";
import { ActivityResultRepository } from "../../../../../domain/repositories/activity-result-repository";
import {
  makeTaskRepository,
  makeWordBuilderTask,
} from "../../../task/use-cases/test-fixtures";

describe("GetEvolutionContextUseCase", () => {
  const educatorId = Uuid.random();
  const student = makeStudent(educatorId, "Ana");
  const appointmentId = Uuid.random();

  let session: TaskNotebookSession;
  let sessionRepository: TaskNotebookSessionRepository;
  let studentRepository: StudentRepository;
  let shareRepository: ReturnType<typeof makeShareRepository>;
  let planRepository: PlanRepository;
  let evolutionRepository: SessionEvolutionRepository;
  let activityResultRepository: ActivityResultRepository;
  let taskRepository: ReturnType<typeof makeTaskRepository>;
  let useCase: GetEvolutionContextUseCase;

  beforeEach(() => {
    // 10/11/2026 10:00 em São Paulo, 42 min de duração.
    session = makeSession({
      studentId: student.id,
      educatorId,
      appointmentId,
      startedAt: new Date("2026-11-10T13:00:00.000Z"),
      finishedAt: new Date("2026-11-10T13:42:10.000Z"),
      answers: [makeAnswer(true), makeAnswer(false), makeAnswer(true)],
    });

    sessionRepository = {
      getById: vi.fn().mockResolvedValue(session),
    } as unknown as TaskNotebookSessionRepository;
    studentRepository = {
      getById: vi.fn().mockResolvedValue(student),
    } as unknown as StudentRepository;
    planRepository = {
      search: vi.fn().mockResolvedValue([]),
    } as unknown as PlanRepository;
    evolutionRepository = {
      findBySessionId: vi.fn().mockResolvedValue(null),
    } as unknown as SessionEvolutionRepository;

    activityResultRepository = {
      listBySessionId: vi.fn().mockResolvedValue([]),
    } as unknown as ActivityResultRepository;
    taskRepository = makeTaskRepository();

    shareRepository = makeShareRepository();
    useCase = new GetEvolutionContextUseCase(
      sessionRepository,
      makeStudentAccess(studentRepository, shareRepository),
      planRepository,
      evolutionRepository,
      activityResultRepository,
      taskRepository
    );
  });

  const execute = (overrides: { educatorId?: Uuid; sessionId?: string } = {}) =>
    useCase.execute({
      educatorId: overrides.educatorId ?? educatorId,
      sessionId: overrides.sessionId ?? session.id.value,
    });

  it("should describe the session with counts, duration and student name", async () => {
    const result = await execute();

    expect(result.ok).toBe(true);
    const context = (result as any).value;
    expect(context.session).toEqual({
      id: session.id.value,
      studentId: student.id.value,
      studentName: "Ana",
      name: session.name,
      startedAt: session.startedAt,
      finishedAt: session.finishedAt,
      durationMinutes: 42,
      appointmentId: appointmentId.value,
      answeredCount: 3,
      correctCount: 2,
    });
    expect(context.existingEvolutionId).toBeUndefined();
  });

  describe("activity results (RS-06)", () => {
    const makeResult = (task: Task, completed: boolean, correct: boolean) => {
      const created = ActivityResult.create({
        sessionId: session.id,
        task,
        completed,
        correct,
        attempts: 3,
        errors: 2,
        durationMs: 20000,
      });
      if (!created.ok) throw new Error(String(created.error));
      return created.value;
    };

    it("BE-RS-03: should list the results with the task title and keep the accuracy", async () => {
      const bola = makeWordBuilderTask();
      const pato = makeWordBuilderTask({ content: { kind: "wordBuilder", word: "PATO" } });
      const results = [makeResult(bola, true, true), makeResult(pato, false, false)];
      (activityResultRepository.listBySessionId as any).mockResolvedValue(results);
      taskRepository.getByIds.mockResolvedValue([pato, bola]);

      const context = ((await execute()) as any).value;

      expect(activityResultRepository.listBySessionId).toHaveBeenCalledWith(session.id);
      expect(taskRepository.getByIds).toHaveBeenCalledTimes(1);
      expect(context.activityResults).toEqual([
        {
          taskId: bola.id.value,
          title: "BOLA",
          taskType: "wordBuilder",
          completed: true,
          correct: true,
          attempts: 3,
          errors: 2,
        },
        {
          taskId: pato.id.value,
          title: "PATO",
          taskType: "wordBuilder",
          completed: false,
          correct: false,
          attempts: 3,
          errors: 2,
        },
      ]);
      // RS-05: o accuracy da sessão continua só das respostas de múltipla escolha.
      expect(context.session.answeredCount).toBe(3);
      expect(context.session.correctCount).toBe(2);
    });

    it("should leave title absent when the task was deleted", async () => {
      const deleted = makeWordBuilderTask();
      (activityResultRepository.listBySessionId as any).mockResolvedValue([
        makeResult(deleted, true, false),
      ]);

      const context = ((await execute()) as any).value;

      expect(context.activityResults).toHaveLength(1);
      expect(context.activityResults[0].title).toBeUndefined();
      expect(JSON.parse(JSON.stringify(context.activityResults[0]))).not.toHaveProperty(
        "title"
      );
    });

    it("should return an empty list without querying tasks when there are no results", async () => {
      const context = ((await execute()) as any).value;

      expect(context.activityResults).toEqual([]);
      expect(taskRepository.getByIds).not.toHaveBeenCalled();
    });
  });

  it("should search only the ACTIVE plans of the student", async () => {
    await execute();

    expect(planRepository.search).toHaveBeenCalledWith({
      studentIds: [student.id],
      status: PlanStatus.ACTIVE,
    });
  });

  it("should use the PE of the appointment and suggest its goals", async () => {
    const pe = makePe(educatorId, student.id, { sessionDate: "2026-11-01", appointmentId });
    const pdi = makePdi(educatorId, student.id);
    (planRepository.search as any).mockResolvedValue([pdi, pe]);

    const context = ((await execute()) as any).value;

    expect(context.plan).toEqual({ id: pe.id.value, type: PlanType.PE, title: pe.title });
    expect(context.suggestedCriteria).toEqual([
      {
        goalId: pe.goals[0].id.value,
        description: "Identificar rimas",
        successCriterion: "4 de 5",
        goalStatus: GoalStatus.NOT_STARTED,
      },
      {
        goalId: pe.goals[1].id.value,
        description: "Produzir rimas",
        successCriterion: undefined,
        goalStatus: GoalStatus.NOT_STARTED,
      },
    ]);
  });

  it("should use the PE of the session date when no PE matches the appointment", async () => {
    const pe = makePe(educatorId, student.id, { sessionDate: "2026-11-10" });
    const pdi = makePdi(educatorId, student.id);
    (planRepository.search as any).mockResolvedValue([pdi, pe]);

    const context = ((await execute()) as any).value;

    expect(context.plan.id).toBe(pe.id.value);
  });

  it("should fall back to the active PDI when there is no PE", async () => {
    const pdi = makePdi(educatorId, student.id);
    (planRepository.search as any).mockResolvedValue([pdi]);

    const context = ((await execute()) as any).value;

    expect(context.plan).toEqual({ id: pdi.id.value, type: PlanType.PDI, title: pdi.title });
    expect(context.suggestedCriteria).toHaveLength(2);
  });

  it("should leave plan absent and suggest nothing when there is no plan", async () => {
    const context = ((await execute()) as any).value;

    expect(context.plan).toBeUndefined();
    expect(context.suggestedCriteria).toEqual([]);
  });

  it("should return the existing evolution id", async () => {
    const existing = SessionEvolution.create({
      session,
      educatorId,
      criteria: [],
      descriptiveRecord: "Registro",
    });
    if (!existing.ok) throw new Error(existing.error);
    (evolutionRepository.findBySessionId as any).mockResolvedValue(existing.value);

    const context = ((await execute()) as any).value;

    expect(context.existingEvolutionId).toBe(existing.value.id.value);
  });

  it("should return SESSION_NOT_FINISHED for an open session", async () => {
    (sessionRepository.getById as any).mockResolvedValue(
      makeSession({ studentId: student.id, educatorId, finishedAt: null })
    );

    expect(await execute()).toEqual({ ok: false, error: "SESSION_NOT_FINISHED" });
  });

  it("should return SESSION_NOT_FOUND for a missing session or an invalid id", async () => {
    expect(await execute({ sessionId: "abc" })).toEqual({
      ok: false,
      error: "SESSION_NOT_FOUND",
    });

    (sessionRepository.getById as any).mockResolvedValue(null);
    expect(await execute()).toEqual({ ok: false, error: "SESSION_NOT_FOUND" });
  });

  it("should give the context to a colleague the student is shared with (EQ-11)", async () => {
    const colleagueId = Uuid.random();
    await shareRepository.create(shareStudent(student, colleagueId));

    const result = await execute({ educatorId: colleagueId });

    expect(result.ok).toBe(true);
    expect((result as any).value.session.studentName).toBe("Ana");

    await shareRepository.delete(student.id, colleagueId);
    expect(await execute({ educatorId: colleagueId })).toEqual({
      ok: false,
      error: "UNAUTHORIZED",
    });
  });

  it("should return UNAUTHORIZED for another educator", async () => {
    expect(await execute({ educatorId: Uuid.random() })).toEqual({
      ok: false,
      error: "UNAUTHORIZED",
    });
    expect(planRepository.search).not.toHaveBeenCalled();
  });
});
