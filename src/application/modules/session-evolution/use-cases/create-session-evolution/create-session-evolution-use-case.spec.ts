import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import {
  CreateSessionEvolutionUseCase,
  CreateSessionEvolutionUseCaseRequest,
} from "./create-session-evolution-use-case";
import { GoalStatus, Plan } from "../../../../../domain/entities/plan";
import {
  CriterionResult,
  SessionEvolution,
} from "../../../../../domain/entities/session-evolution";
import { TaskNotebookSession } from "../../../../../domain/entities/task-notebook-session";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { closePlan, makePdi, makeSession, makeStudent } from "../test-fixtures";

describe("CreateSessionEvolutionUseCase", () => {
  const educatorId = Uuid.random();
  const student = makeStudent(educatorId);

  let session: TaskNotebookSession;
  let plan: Plan;
  let sessionRepository: TaskNotebookSessionRepository;
  let studentRepository: StudentRepository;
  let planRepository: PlanRepository;
  let evolutionRepository: SessionEvolutionRepository;
  let useCase: CreateSessionEvolutionUseCase;

  const request = (
    overrides: Partial<CreateSessionEvolutionUseCaseRequest> = {}
  ): CreateSessionEvolutionUseCaseRequest => ({
    educatorId,
    sessionId: session.id.value,
    criteria: [
      {
        description: "Leu sílabas",
        attempts: 10,
        successes: 8,
        result: CriterionResult.PARTIAL,
      },
    ],
    descriptiveRecord: "Registro da sessão",
    ...overrides,
  });

  const expectNothingSaved = () => {
    expect(planRepository.save).not.toHaveBeenCalled();
    expect(evolutionRepository.save).not.toHaveBeenCalled();
    expect(sessionRepository.save).not.toHaveBeenCalled();
  };

  beforeEach(() => {
    session = makeSession({ studentId: student.id, educatorId });
    plan = makePdi(educatorId, student.id);

    sessionRepository = {
      getById: vi.fn().mockResolvedValue(session),
      save: vi.fn().mockResolvedValue(undefined),
    } as unknown as TaskNotebookSessionRepository;
    studentRepository = {
      getById: vi.fn().mockResolvedValue(student),
    } as unknown as StudentRepository;
    planRepository = {
      findById: vi.fn().mockResolvedValue(plan),
      save: vi.fn().mockResolvedValue(undefined),
    } as unknown as PlanRepository;
    evolutionRepository = {
      findBySessionId: vi.fn().mockResolvedValue(null),
      save: vi.fn().mockResolvedValue(undefined),
    } as unknown as SessionEvolutionRepository;

    useCase = new CreateSessionEvolutionUseCase(
      sessionRepository,
      studentRepository,
      planRepository,
      evolutionRepository
    );
  });

  it("should create the evolution of a finished session", async () => {
    const result = await useCase.execute(request());

    expect(result.ok).toBe(true);
    const evolution = (result as any).value as SessionEvolution;
    expect(evolution.sessionId.value).toBe(session.id.value);
    expect(evolution.studentId.value).toBe(student.id.value);
    expect(evolution.educatorId.value).toBe(educatorId.value);
    expect(evolution.criteria).toHaveLength(1);
    expect(evolution.planId).toBeUndefined();
    expect(evolutionRepository.save).toHaveBeenCalledWith(evolution);
    expect(planRepository.save).not.toHaveBeenCalled();
  });

  it("should copy the descriptive record to the session observation", async () => {
    await useCase.execute(request({ descriptiveRecord: "Leu bem hoje" }));

    expect(sessionRepository.save).toHaveBeenCalledTimes(1);
    const saved = (sessionRepository.save as any).mock.calls[0][0] as TaskNotebookSession;
    expect(saved.id.value).toBe(session.id.value);
    expect(saved.observation).toBe("Leu bem hoje");
    expect(saved.finishedAt).toEqual(session.finishedAt);
  });

  it("should return 409 payload with the existing evolution id on a second creation", async () => {
    const first = await useCase.execute(request());
    const existing = (first as any).value as SessionEvolution;
    vi.clearAllMocks();
    (evolutionRepository.findBySessionId as any).mockResolvedValue(existing);

    const result = await useCase.execute(request());

    expect(result).toEqual({
      ok: false,
      error: { code: "EVOLUTION_ALREADY_EXISTS", evolutionId: existing.id.value },
    });
    expectNothingSaved();
  });

  it("should reject an open session", async () => {
    (sessionRepository.getById as any).mockResolvedValue(
      makeSession({ studentId: student.id, educatorId, finishedAt: null })
    );

    const result = await useCase.execute(request());

    expect(result).toEqual({ ok: false, error: "SESSION_NOT_FINISHED" });
    expectNothingSaved();
  });

  it("should return SESSION_NOT_FOUND for a missing session or an invalid id", async () => {
    (sessionRepository.getById as any).mockResolvedValue(null);

    expect(await useCase.execute(request())).toEqual({
      ok: false,
      error: "SESSION_NOT_FOUND",
    });
    expect(await useCase.execute(request({ sessionId: "nao-e-uuid" }))).toEqual({
      ok: false,
      error: "SESSION_NOT_FOUND",
    });
    expectNothingSaved();
  });

  it("should return UNAUTHORIZED when the student belongs to another educator", async () => {
    const result = await useCase.execute(request({ educatorId: Uuid.random() }));

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expectNothingSaved();
  });

  it("should apply ACHIEVED goalUpdates to the plan and recalculate progress", async () => {
    const goalId = plan.goals[0].id.value;

    const result = await useCase.execute(
      request({
        planId: plan.id.value,
        criteria: [{ goalId, description: "Ler sílabas", result: CriterionResult.ACHIEVED }],
        goalUpdates: [{ goalId, status: GoalStatus.ACHIEVED }],
      })
    );

    expect(result.ok).toBe(true);
    const evolution = (result as any).value as SessionEvolution;
    expect(evolution.planId?.value).toBe(plan.id.value);
    expect(evolution.goalUpdates).toEqual([{ goalId, status: GoalStatus.ACHIEVED }]);

    expect(planRepository.save).toHaveBeenCalledTimes(1);
    const savedPlan = (planRepository.save as any).mock.calls[0][0] as Plan;
    expect(savedPlan.goals[0].status).toBe(GoalStatus.ACHIEVED);
    expect(savedPlan.goals[0].achievedAt).toBeInstanceOf(Date);
    expect(savedPlan.progress.percent).toBe(50);
  });

  it("should save the plan, then the evolution, then the session", async () => {
    const goalId = plan.goals[0].id.value;

    await useCase.execute(
      request({
        planId: plan.id.value,
        goalUpdates: [{ goalId, status: GoalStatus.IN_PROGRESS }],
      })
    );

    const planOrder = (planRepository.save as any).mock.invocationCallOrder[0];
    const evolutionOrder = (evolutionRepository.save as any).mock.invocationCallOrder[0];
    const sessionOrder = (sessionRepository.save as any).mock.invocationCallOrder[0];
    expect(planOrder).toBeLessThan(evolutionOrder);
    expect(evolutionOrder).toBeLessThan(sessionOrder);
  });

  it("should not save the plan when goalUpdates match the current status", async () => {
    const result = await useCase.execute(
      request({
        planId: plan.id.value,
        goalUpdates: [{ goalId: plan.goals[0].id.value, status: GoalStatus.NOT_STARTED }],
      })
    );

    expect(result.ok).toBe(true);
    expect(planRepository.save).not.toHaveBeenCalled();
    expect(evolutionRepository.save).toHaveBeenCalledTimes(1);
  });

  it("should fail with PLAN_NOT_EDITABLE and save nothing when the plan is closed and goalUpdates are sent", async () => {
    (planRepository.findById as any).mockResolvedValue(closePlan(plan));

    const result = await useCase.execute(
      request({
        planId: plan.id.value,
        goalUpdates: [{ goalId: plan.goals[0].id.value, status: GoalStatus.ACHIEVED }],
      })
    );

    expect(result).toEqual({ ok: false, error: "PLAN_NOT_EDITABLE" });
    expectNothingSaved();
  });

  it("should return INVALID_PLAN for a closed plan without goalUpdates", async () => {
    (planRepository.findById as any).mockResolvedValue(closePlan(plan));

    const result = await useCase.execute(request({ planId: plan.id.value }));

    expect(result).toEqual({ ok: false, error: "INVALID_PLAN" });
    expectNothingSaved();
  });

  it("should return INVALID_PLAN for a missing plan or a plan of another student", async () => {
    (planRepository.findById as any).mockResolvedValue(null);
    expect(await useCase.execute(request({ planId: Uuid.random().value }))).toEqual({
      ok: false,
      error: "INVALID_PLAN",
    });

    (planRepository.findById as any).mockResolvedValue(
      makePdi(educatorId, Uuid.random())
    );
    expect(await useCase.execute(request({ planId: plan.id.value }))).toEqual({
      ok: false,
      error: "INVALID_PLAN",
    });
    expectNothingSaved();
  });

  it("should return GOAL_NOT_IN_PLAN and save nothing for a goal of another plan", async () => {
    const result = await useCase.execute(
      request({
        planId: plan.id.value,
        goalUpdates: [{ goalId: Uuid.random().value, status: GoalStatus.ACHIEVED }],
      })
    );

    expect(result).toEqual({ ok: false, error: "GOAL_NOT_IN_PLAN" });
    expectNothingSaved();
  });

  it("should return INVALID_ATTEMPTS and save nothing when successes exceed attempts", async () => {
    const result = await useCase.execute(
      request({
        criteria: [
          { description: "Leu", attempts: 3, successes: 4, result: CriterionResult.PARTIAL },
        ],
      })
    );

    expect(result).toEqual({ ok: false, error: "INVALID_ATTEMPTS" });
    expectNothingSaved();
  });
});
