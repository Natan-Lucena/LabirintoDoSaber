import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { NextSessionSuggestionUseCase } from "./next-session-suggestion-use-case";
import { CriterionResult, SessionEvolution } from "../../../../../domain/entities/session-evolution";
import { Gender } from "../../../../../domain/entities/student";
import { TaskNotebookSession } from "../../../../../domain/entities/task-notebook-session";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { AiInvalidOutputError } from "../../../../../domain/services/ai-errors";
import { AiClinicalService } from "../../../../../domain/services/ai-clinical-service";
import { nextSessionSuggestionSchema } from "../../schemas/next-session-suggestion.schema";
import {
  expectNoIdentifiableData,
  IDENTIFIABLE,
  makeAnswer,
  makeIdentifiableStudent,
  makePdi,
  makeSession,
} from "../test-fixtures";

const makeEvolution = (session: TaskNotebookSession, educatorId: Uuid, record: string) => {
  const result = SessionEvolution.create({
    session,
    educatorId,
    criteria: [
      { description: "Ler sílabas", result: CriterionResult.ACHIEVED },
      { description: "Ler palavras", result: CriterionResult.PARTIAL },
    ],
    descriptiveRecord: record,
  });
  if (!result.ok) throw new Error(String(result.error));
  return result.value;
};

describe("NextSessionSuggestionUseCase", () => {
  const educatorId = Uuid.random();
  const student = makeIdentifiableStudent(educatorId);
  const pdi = makePdi(educatorId, student.id, `PDI de ${IDENTIFIABLE.name}`);

  let session: TaskNotebookSession;
  let sessionRepository: TaskNotebookSessionRepository;
  let studentRepository: StudentRepository;
  let planRepository: PlanRepository;
  let evolutionRepository: SessionEvolutionRepository;
  let aiService: AiClinicalService;
  let useCase: NextSessionSuggestionUseCase;

  const aiParams = () => (aiService.nextSessionSuggestion as any).mock.calls[0][0];

  beforeEach(() => {
    session = makeSession({
      studentId: student.id,
      educatorId,
      name: `Sessão de ${IDENTIFIABLE.name}`,
      startedAt: new Date("2026-11-10T13:00:00.000Z"),
      finishedAt: new Date("2026-11-10T13:40:00.000Z"),
      answers: [makeAnswer(true), makeAnswer(false), makeAnswer(true)],
    });

    sessionRepository = {
      getById: vi.fn().mockResolvedValue(session),
    } as unknown as TaskNotebookSessionRepository;
    studentRepository = {
      getById: vi.fn().mockResolvedValue(student),
    } as unknown as StudentRepository;
    planRepository = {
      save: vi.fn(),
      search: vi.fn().mockResolvedValue([pdi]),
    } as unknown as PlanRepository;
    evolutionRepository = {
      save: vi.fn(),
      search: vi.fn().mockResolvedValue([]),
    } as unknown as SessionEvolutionRepository;
    aiService = {
      nextSessionSuggestion: vi.fn().mockResolvedValue({
        suggestion: "Retomar a leitura de sílabas com apoio visual.",
        rationale: "Houve acerto parcial nas palavras.",
      }),
      scaleInsight: vi.fn(),
      anamneseSummary: vi.fn(),
    };

    useCase = new NextSessionSuggestionUseCase(
      sessionRepository,
      studentRepository,
      planRepository,
      evolutionRepository,
      aiService
    );
  });

  afterEach(() => {
    // BE-EV-08: a sugestão não cria nem altera registro.
    expect(evolutionRepository.save).not.toHaveBeenCalled();
    expect(planRepository.save).not.toHaveBeenCalled();
  });

  const execute = (overrides: Record<string, unknown> = {}) =>
    useCase.execute({
      educatorId,
      sessionId: session.id.value,
      criteria: [
        {
          description: "Ler sílabas",
          successCriterion: "8 de 10",
          attempts: 10,
          successes: 8,
          result: CriterionResult.ACHIEVED,
          note: "com apoio",
        },
      ],
      descriptiveRecord: "Leu as sílabas com apoio visual.",
      ...overrides,
    });

  it("returns the suggestion and rationale without persisting anything", async () => {
    const result = await execute();

    expect(result).toEqual({
      ok: true,
      value: {
        suggestion: "Retomar a leitura de sílabas com apoio visual.",
        rationale: "Houve acerto parcial nas palavras.",
      },
    });
  });

  it("builds the context with plan goals, received data, session accuracy and recent evolutions", async () => {
    const previous = Array.from({ length: 4 }, (_, i) =>
      makeEvolution(
        makeSession({
          studentId: student.id,
          educatorId,
          startedAt: new Date(`2026-11-0${i + 1}T13:00:00.000Z`),
        }),
        educatorId,
        `Registro ${i + 1} ` + "x".repeat(300)
      )
    ).reverse();
    (evolutionRepository.search as any).mockResolvedValue(previous);

    await execute();

    expect(planRepository.search).toHaveBeenCalledWith(
      expect.objectContaining({ studentId: student.id })
    );
    expect(evolutionRepository.search).toHaveBeenCalledWith(
      // Só até a data da sessão: evoluções posteriores não entram.
      expect.objectContaining({ studentIds: [student.id], to: "2026-11-10" })
    );
    const params = aiParams();
    expect(params.student).toEqual({ age: 7, gender: Gender.Male });
    expect(params.planGoals).toEqual([
      { description: "Ler sílabas", successCriterion: undefined },
      { description: "Ler palavras", successCriterion: undefined },
    ]);
    expect(params.session).toEqual({
      durationMinutes: 40,
      answeredCount: 3,
      correctCount: 2,
    });
    expect(params.criteria).toEqual([
      {
        description: "Ler sílabas",
        successCriterion: "8 de 10",
        attempts: 10,
        successes: 8,
        result: CriterionResult.ACHIEVED,
        note: "com apoio",
      },
    ]);
    expect(params.descriptiveRecord).toBe("Leu as sílabas com apoio visual.");
    expect(params.recentEvolutions).toHaveLength(3);
    expect(params.recentEvolutions[0]).toEqual({
      sessionDate: "2026-11-04",
      achievedCount: 1,
      criteriaCount: 2,
      excerpt: ("Registro 4 " + "x".repeat(300)).slice(0, 200),
    });
  });

  it("leaves the evolution of the same session out of the recent ones", async () => {
    const current = makeEvolution(session, educatorId, "Registro desta sessão");
    (evolutionRepository.search as any).mockResolvedValue([current]);

    await execute();

    expect(aiParams().recentEvolutions).toEqual([]);
  });

  it("works without plan, criteria and record", async () => {
    (planRepository.search as any).mockResolvedValue([]);

    const result = await execute({ criteria: undefined, descriptiveRecord: undefined });

    expect(result.ok).toBe(true);
    const params = aiParams();
    expect(params.planGoals).toBeUndefined();
    expect(params.criteria).toEqual([]);
    expect(params.descriptiveRecord).toBeUndefined();
  });

  it("does not send identifiable data of the student to the AI", async () => {
    await execute();

    expectNoIdentifiableData(aiParams());
    // Nome da sessão e título do plano podem trazer o nome da criança.
    const serialized = JSON.stringify(aiParams());
    expect(serialized).not.toContain('"title"');
    expect(serialized).not.toContain('"name"');
    expect(serialized).not.toContain("Sessão de");
  });

  it("returns AI_GENERATION_FAILED when the service throws, logging only code and status", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    (aiService.nextSessionSuggestion as any).mockRejectedValue(
      Object.assign(new Error("503 overloaded Leu as sílabas"), { status: 503 })
    );

    const result = await execute();

    expect(result).toEqual({ ok: false, error: "AI_GENERATION_FAILED" });
    const logged = JSON.stringify(consoleError.mock.calls);
    expect(logged).not.toContain("overloaded");
    expect(logged).not.toContain("Leu as sílabas");
    consoleError.mockRestore();
  });

  it("returns AI_INVALID_OUTPUT when the service throws AiInvalidOutputError", async () => {
    (aiService.nextSessionSuggestion as any).mockRejectedValue(new AiInvalidOutputError());

    const result = await execute();

    expect(result).toEqual({ ok: false, error: "AI_INVALID_OUTPUT" });
  });

  it("returns AI_INVALID_OUTPUT when the suggestion is empty", async () => {
    (aiService.nextSessionSuggestion as any).mockResolvedValue({
      suggestion: "   ",
      rationale: "algo",
    });

    const result = await execute();

    expect(result).toEqual({ ok: false, error: "AI_INVALID_OUTPUT" });
  });

  it("truncates texts over the limits and drops an empty rationale", async () => {
    (aiService.nextSessionSuggestion as any).mockResolvedValue({
      suggestion: "s".repeat(1500),
      rationale: "r".repeat(900),
    });

    const long = await execute();
    expect(long.ok).toBe(true);
    if (!long.ok) return;
    expect(long.value.suggestion).toHaveLength(1000);
    expect(long.value.rationale).toHaveLength(500);

    (aiService.nextSessionSuggestion as any).mockResolvedValue({
      suggestion: "  Sugestão  ",
      rationale: "  ",
    });
    const empty = await execute();
    expect(empty).toEqual({ ok: true, value: { suggestion: "Sugestão" } });
  });

  it("returns UNAUTHORIZED for a session of a student of another educator", async () => {
    const result = await execute({ educatorId: Uuid.random() });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(aiService.nextSessionSuggestion).not.toHaveBeenCalled();
  });

  it("returns SESSION_NOT_FOUND for an unknown or invalid session id", async () => {
    (sessionRepository.getById as any).mockResolvedValue(null);

    expect(await execute()).toEqual({ ok: false, error: "SESSION_NOT_FOUND" });
    expect(await execute({ sessionId: "nao-e-uuid" })).toEqual({
      ok: false,
      error: "SESSION_NOT_FOUND",
    });
  });

  it("returns SESSION_NOT_FINISHED for an open session", async () => {
    (sessionRepository.getById as any).mockResolvedValue(
      makeSession({ studentId: student.id, educatorId, finishedAt: null })
    );

    const result = await execute();

    expect(result).toEqual({ ok: false, error: "SESSION_NOT_FINISHED" });
    expect(aiService.nextSessionSuggestion).not.toHaveBeenCalled();
  });
});

describe("nextSessionSuggestionSchema", () => {
  it("requires a uuid sessionId and accepts optional criteria and record", () => {
    expect(nextSessionSuggestionSchema.safeParse({}).success).toBe(false);
    expect(nextSessionSuggestionSchema.safeParse({ sessionId: "x" }).success).toBe(false);
    expect(
      nextSessionSuggestionSchema.safeParse({ sessionId: Uuid.random().value }).success
    ).toBe(true);
  });

  it("limits the descriptive record to 5000 characters", () => {
    const sessionId = Uuid.random().value;
    expect(
      nextSessionSuggestionSchema.safeParse({ sessionId, descriptiveRecord: "a".repeat(5001) })
        .success
    ).toBe(false);
    expect(
      nextSessionSuggestionSchema.safeParse({ sessionId, descriptiveRecord: "a".repeat(5000) })
        .success
    ).toBe(true);
  });
});
