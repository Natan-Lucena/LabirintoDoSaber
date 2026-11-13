import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { UpdateSessionEvolutionUseCase } from "./update-session-evolution-use-case";
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

describe("UpdateSessionEvolutionUseCase", () => {
  const educatorId = Uuid.random();
  const student = makeStudent(educatorId);

  let session: TaskNotebookSession;
  let plan: Plan;
  let evolution: SessionEvolution;
  let evolutionRepository: SessionEvolutionRepository;
  let studentRepository: StudentRepository;
  let planRepository: PlanRepository;
  let sessionRepository: TaskNotebookSessionRepository;
  let useCase: UpdateSessionEvolutionUseCase;

  const createEvolution = (withPlan: boolean) => {
    const created = SessionEvolution.create({
      session,
      educatorId,
      plan: withPlan ? plan : undefined,
      criteria: [{ description: "Leu", result: CriterionResult.PARTIAL }],
      descriptiveRecord: "Registro original",
    });
    if (!created.ok) throw new Error(created.error);
    return created.value;
  };

  const expectNothingSaved = () => {
    expect(planRepository.save).not.toHaveBeenCalled();
    expect(evolutionRepository.save).not.toHaveBeenCalled();
    expect(sessionRepository.save).not.toHaveBeenCalled();
  };

  beforeEach(() => {
    session = makeSession({ studentId: student.id, educatorId });
    plan = makePdi(educatorId, student.id);
    evolution = createEvolution(true);

    evolutionRepository = {
      findById: vi.fn().mockResolvedValue(evolution),
      save: vi.fn().mockResolvedValue(undefined),
    } as unknown as SessionEvolutionRepository;
    studentRepository = {
      getById: vi.fn().mockResolvedValue(student),
    } as unknown as StudentRepository;
    planRepository = {
      findById: vi.fn().mockResolvedValue(plan),
      save: vi.fn().mockResolvedValue(undefined),
    } as unknown as PlanRepository;
    sessionRepository = {
      getById: vi.fn().mockResolvedValue(session),
      save: vi.fn().mockResolvedValue(undefined),
    } as unknown as TaskNotebookSessionRepository;

    useCase = new UpdateSessionEvolutionUseCase(
      evolutionRepository,
      studentRepository,
      planRepository,
      sessionRepository
    );
  });

  it("should update the record and copy it to the session observation", async () => {
    const result = await useCase.execute({
      educatorId,
      evolutionId: evolution.id.value,
      descriptiveRecord: "Registro corrigido",
    });

    expect(result.ok).toBe(true);
    const updated = (result as any).value as SessionEvolution;
    expect(updated.descriptiveRecord).toBe("Registro corrigido");
    expect(evolutionRepository.save).toHaveBeenCalledWith(updated);
    const savedSession = (sessionRepository.save as any).mock.calls[0][0] as TaskNotebookSession;
    expect(savedSession.id.value).toBe(session.id.value);
    expect(savedSession.observation).toBe("Registro corrigido");
  });

  it("should not touch the session when the record is not sent", async () => {
    const result = await useCase.execute({
      educatorId,
      evolutionId: evolution.id.value,
      criteria: [
        { goalId: plan.goals[1].id.value, description: "Palavras", result: CriterionResult.ACHIEVED },
      ],
    });

    expect(result.ok).toBe(true);
    expect((result as any).value.criteria[0].goalId.value).toBe(plan.goals[1].id.value);
    expect(sessionRepository.save).not.toHaveBeenCalled();
  });

  it("should apply only the goalUpdates that differ from the plan", async () => {
    const result = await useCase.execute({
      educatorId,
      evolutionId: evolution.id.value,
      goalUpdates: [
        { goalId: plan.goals[0].id.value, status: GoalStatus.NOT_STARTED },
        { goalId: plan.goals[1].id.value, status: GoalStatus.ACHIEVED },
      ],
    });

    expect(result.ok).toBe(true);
    expect(planRepository.findById).toHaveBeenCalledWith(evolution.planId);
    const savedPlan = (planRepository.save as any).mock.calls[0][0] as Plan;
    expect(savedPlan.goals[0].status).toBe(GoalStatus.NOT_STARTED);
    expect(savedPlan.goals[0].updatedAt).toEqual(plan.goals[0].updatedAt);
    expect(savedPlan.goals[1].status).toBe(GoalStatus.ACHIEVED);
  });

  it("should not save the plan when every goal is already in the requested status", async () => {
    const result = await useCase.execute({
      educatorId,
      evolutionId: evolution.id.value,
      goalUpdates: [{ goalId: plan.goals[0].id.value, status: GoalStatus.NOT_STARTED }],
    });

    expect(result.ok).toBe(true);
    expect(planRepository.save).not.toHaveBeenCalled();
    expect(evolutionRepository.save).toHaveBeenCalledTimes(1);
  });

  it("should fail with PLAN_NOT_EDITABLE and save nothing when the plan is closed", async () => {
    (planRepository.findById as any).mockResolvedValue(closePlan(plan));

    const result = await useCase.execute({
      educatorId,
      evolutionId: evolution.id.value,
      descriptiveRecord: "Novo",
      goalUpdates: [{ goalId: plan.goals[0].id.value, status: GoalStatus.ACHIEVED }],
    });

    expect(result).toEqual({ ok: false, error: "PLAN_NOT_EDITABLE" });
    expectNothingSaved();
  });

  it("should return INVALID_PLAN for goalUpdates on an evolution without plan", async () => {
    (evolutionRepository.findById as any).mockResolvedValue(createEvolution(false));

    const result = await useCase.execute({
      educatorId,
      evolutionId: evolution.id.value,
      goalUpdates: [{ goalId: plan.goals[0].id.value, status: GoalStatus.ACHIEVED }],
    });

    expect(result).toEqual({ ok: false, error: "INVALID_PLAN" });
    expect(planRepository.findById).not.toHaveBeenCalled();
    expectNothingSaved();
  });

  it("should return UNAUTHORIZED for another educator", async () => {
    const result = await useCase.execute({
      educatorId: Uuid.random(),
      evolutionId: evolution.id.value,
      descriptiveRecord: "Novo",
    });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expectNothingSaved();
  });

  it("should return EVOLUTION_NOT_FOUND for an invalid id", async () => {
    const result = await useCase.execute({
      educatorId,
      evolutionId: "nao-e-uuid",
      descriptiveRecord: "Novo",
    });

    expect(result).toEqual({ ok: false, error: "EVOLUTION_NOT_FOUND" });
    expectNothingSaved();
  });
  it("should return INVALID_PLAN for goalUpdates on a plan of another educator", async () => {
    const foreignPlan = makePdi(Uuid.random(), student.id);
    (planRepository.findById as any).mockResolvedValue(foreignPlan);

    const result = await useCase.execute({
      educatorId,
      evolutionId: evolution.id.value,
      goalUpdates: [{ goalId: foreignPlan.goals[0].id.value, status: GoalStatus.ACHIEVED }],
    });

    expect(result).toEqual({ ok: false, error: "INVALID_PLAN" });
    expectNothingSaved();
  });
});
