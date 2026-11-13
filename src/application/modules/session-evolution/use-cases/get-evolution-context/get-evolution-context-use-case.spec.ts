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
import { makeAnswer, makePdi, makePe, makeSession, makeStudent } from "../test-fixtures";

describe("GetEvolutionContextUseCase", () => {
  const educatorId = Uuid.random();
  const student = makeStudent(educatorId, "Ana");
  const appointmentId = Uuid.random();

  let session: TaskNotebookSession;
  let sessionRepository: TaskNotebookSessionRepository;
  let studentRepository: StudentRepository;
  let planRepository: PlanRepository;
  let evolutionRepository: SessionEvolutionRepository;
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

    useCase = new GetEvolutionContextUseCase(
      sessionRepository,
      studentRepository,
      planRepository,
      evolutionRepository
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

  it("should search only the ACTIVE plans of the student", async () => {
    await execute();

    expect(planRepository.search).toHaveBeenCalledWith({
      educatorId,
      studentId: student.id,
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

  it("should return UNAUTHORIZED for another educator", async () => {
    expect(await execute({ educatorId: Uuid.random() })).toEqual({
      ok: false,
      error: "UNAUTHORIZED",
    });
    expect(planRepository.search).not.toHaveBeenCalled();
  });
});
