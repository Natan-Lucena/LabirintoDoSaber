import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { success, Uuid } from "@wave-telecom/framework/core";
import {
  GeneratePlanDraftUseCase,
  GeneratePlanDraftUseCaseRequest,
} from "./generate-plan-draft-use-case";
import { Plan, PlanSource, PlanType } from "../../../../../domain/entities/plan";
import { Gender, Student } from "../../../../../domain/entities/student";
import {
  AnamneseQuestionType,
  AnamneseTemplate,
} from "../../../../../domain/entities/anamnese-template";
import { TaskCategory } from "../../../../../domain/entities/task";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { AnamneseTemplateRepository } from "../../../../../domain/repositories/anamnese-template-repository";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";
import {
  AiInvalidOutputError,
  AiPlanGeneratorService,
  PlanDraftOutput,
} from "../../../../../domain/services/ai-plan-generator-service";
import { AnamneseContextBuilder } from "../../../../services/anamnese-context-builder";
import { GenerateStudentAnalysisUseCase } from "../../../task-notebook-session/use-cases/generate-student-analisys/generate-student-analisys-use-case";
import { generatePlanDraftSchema } from "../../schemas/generate-plan-draft.schema";

const STUDENT_NAME = "Mariazinha Fixture da Silva";

const makeStudent = (educatorId: Uuid) =>
  Student.create({
    name: STUDENT_NAME,
    age: 9,
    gender: Gender.Female,
    zipcode: "01310100",
    road: "Avenida Paulista Fixture",
    housenumber: "1578",
    phonenumber: "11987654321",
    learningTopics: ["leitura"],
    educators: [],
    educatorId,
    photoUrl: "https://bucket/foto-fixture.png",
    documents: [
      {
        id: "doc-1",
        name: "laudo-fixture.pdf",
        url: "https://bucket/laudo-fixture.pdf",
        uploadedAt: new Date(),
      },
    ],
  });

const makePdi = (educatorId: Uuid, studentId: Uuid) => {
  const result = Plan.create({
    educatorId,
    studentId,
    type: PlanType.PDI,
    source: PlanSource.MANUAL,
    title: "PDI",
    generalObjective: "Objetivo",
    startDate: "2026-01-01",
    endDate: "2026-06-30",
    goals: [{ description: "Ler sílabas simples", successCriterion: "8 de 10" }],
  });
  if (!result.ok) throw new Error(result.error);
  return result.value;
};

const makeTemplate = (educatorId: Uuid) => {
  const result = AnamneseTemplate.create({
    educatorId,
    title: "Anamnese inicial",
    questions: [
      { text: "Como dorme?", type: AnamneseQuestionType.Descriptive, required: false },
      { text: "Laudo", type: AnamneseQuestionType.FileUpload, required: false },
    ],
  });
  if (!result.ok) throw new Error("template");
  return result.value;
};

const goals = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    description: `Meta ${i + 1}`,
    successCriterion: `Critério ${i + 1}`,
  }));

const validOutput = (n = 4): PlanDraftOutput => ({
  title: "Plano de leitura",
  generalObjective: "Desenvolver a fluência de leitura",
  goals: goals(n),
  rationale: "Baseado nas métricas recentes",
});

const finishedSession = (day: number, observation?: string) => ({
  id: Uuid.random(),
  name: `Sessão ${day}`,
  startedAt: new Date(`2026-10-${String(day).padStart(2, "0")}T15:00:00.000Z`),
  finishedAt: new Date(`2026-10-${String(day).padStart(2, "0")}T15:30:00.000Z`),
  observation,
  answers: [],
});

const analysisData = (sessions: any[]) =>
  success({
    student: {},
    sessions,
    taskById: new Map(),
    categories: {
      [TaskCategory.Reading]: {
        category: TaskCategory.Reading,
        total: 4,
        correct: 3,
        accuracy: 0.75,
      },
    },
    total: { total: 4, correct: 3, accuracy: 0.75 },
  }) as any;

describe("GeneratePlanDraftUseCase", () => {
  const educatorId = Uuid.random();
  const student = makeStudent(educatorId);

  let planRepository: PlanRepository;
  let studentRepository: StudentRepository;
  let templateRepository: AnamneseTemplateRepository;
  let responseRepository: AnamneseResponseRepository;
  let analysisUseCase: GenerateStudentAnalysisUseCase;
  let aiService: AiPlanGeneratorService;
  let useCase: GeneratePlanDraftUseCase;

  const pdiRequest: GeneratePlanDraftUseCaseRequest = {
    educatorId,
    studentId: student.id.value,
    type: PlanType.PDI,
    focus: "Leitura e escrita",
    consideredDifficulties: ["troca de letras", "atenção"],
    durationMonths: 6,
  };

  const peRequest: GeneratePlanDraftUseCaseRequest = {
    educatorId,
    studentId: student.id.value,
    type: PlanType.PE,
    focus: "Consciência fonológica",
    consideredDifficulties: ["rimas"],
    sessionDate: "2026-11-05",
  };

  const lastContext = () => (aiService.generateDraft as any).mock.calls[0][0];

  beforeEach(() => {
    planRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      findActivePdi: vi.fn(),
      search: vi.fn(),
    } as unknown as PlanRepository;
    studentRepository = {
      getById: vi.fn().mockResolvedValue(student),
    } as unknown as StudentRepository;
    templateRepository = { findById: vi.fn() } as unknown as AnamneseTemplateRepository;
    responseRepository = {
      listByStudentId: vi.fn().mockResolvedValue([]),
    } as unknown as AnamneseResponseRepository;
    analysisUseCase = {
      loadAnalysisData: vi
        .fn()
        .mockResolvedValue(analysisData([finishedSession(20, "Leu com apoio")])),
    } as unknown as GenerateStudentAnalysisUseCase;
    aiService = {
      generateDraft: vi.fn().mockResolvedValue(validOutput()),
    } as unknown as AiPlanGeneratorService;

    useCase = new GeneratePlanDraftUseCase(
      planRepository,
      studentRepository,
      templateRepository,
      new AnamneseContextBuilder(templateRepository, responseRepository),
      analysisUseCase,
      aiService
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    expect(planRepository.save).not.toHaveBeenCalled();
  });

  it("does not send identifiable data of the student to the AI", async () => {
    const template = makeTemplate(educatorId);
    (templateRepository.findById as any).mockResolvedValue(template);
    (responseRepository.listByStudentId as any).mockResolvedValue([
      {
        templateId: template.id,
        answers: [
          { questionId: template.questions[0].id, textValue: "Dorme bem" },
          {
            questionId: template.questions[1].id,
            fileUrl: "https://bucket/anamnese-laudo-fixture.pdf",
          },
        ],
      },
    ]);

    const result = await useCase.execute({
      ...pdiRequest,
      includeAnamnesisTemplateId: template.id.value,
    });

    expect(result.ok).toBe(true);
    const params = lastContext();
    const serialized = JSON.stringify(params);

    for (const key of ["name", "phonenumber", "road", "zipcode", "documents", "photoUrl"]) {
      expect(serialized).not.toContain(`"${key}"`);
    }
    expect(serialized).not.toContain(STUDENT_NAME);
    expect(serialized).not.toContain("11987654321");
    expect(serialized).not.toContain("Paulista");
    expect(serialized).not.toContain("laudo-fixture");
    expect(params.context.student).toEqual({ age: 9, gender: Gender.Female });
    expect(params.context.anamnese.answers[0]).toEqual({
      question: "Como dorme?",
      answer: "Dorme bem",
    });
  });

  it("builds the context with metrics, recent observations and history flag", async () => {
    (analysisUseCase.loadAnalysisData as any).mockResolvedValue(
      analysisData([
        finishedSession(27, "Obs 1"),
        finishedSession(26),
        finishedSession(25, "Obs 2"),
        finishedSession(24, "Obs 3"),
        finishedSession(23, "Obs 4"),
        finishedSession(22, "Obs 5"),
        finishedSession(21, "Obs 6"),
      ])
    );

    await useCase.execute(pdiRequest);

    expect(analysisUseCase.loadAnalysisData).toHaveBeenCalledWith({
      studentId: student.id.value,
      limit: 10,
    });
    const { context, type, durationMonths } = lastContext();
    expect(type).toBe(PlanType.PDI);
    expect(durationMonths).toBe(6);
    expect(context.hasSessionHistory).toBe(true);
    expect(context.metrics.total).toEqual({ total: 4, correct: 3, accuracy: 0.75 });
    expect(context.recentObservations).toHaveLength(5);
    expect(context.recentObservations[0]).toEqual({
      sessionDate: "2026-10-27",
      observation: "Obs 1",
    });
    expect(context.focus).toBe(pdiRequest.focus);
    expect(context.consideredDifficulties).toEqual(pdiRequest.consideredDifficulties);
  });

  it("flags hasSessionHistory false and fills rationale when there are no sessions", async () => {
    (analysisUseCase.loadAnalysisData as any).mockResolvedValue(analysisData([]));
    (aiService.generateDraft as any).mockResolvedValue({
      ...validOutput(),
      rationale: undefined,
    });

    const result = await useCase.execute(pdiRequest);

    expect(lastContext().context.hasSessionHistory).toBe(false);
    expect(lastContext().context.recentObservations).toEqual([]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rationale).toMatch(/sem histórico de sessões/);
  });

  it("returns AI_INVALID_OUTPUT with 2 goals", async () => {
    (aiService.generateDraft as any).mockResolvedValue(validOutput(2));

    const result = await useCase.execute(pdiRequest);

    expect(result).toEqual({ ok: false, error: "AI_INVALID_OUTPUT" });
  });

  it("returns AI_INVALID_OUTPUT with 7 goals", async () => {
    (aiService.generateDraft as any).mockResolvedValue(validOutput(7));

    const result = await useCase.execute(pdiRequest);

    expect(result).toEqual({ ok: false, error: "AI_INVALID_OUTPUT" });
  });

  it("discards empty goals before counting", async () => {
    (aiService.generateDraft as any).mockResolvedValue({
      ...validOutput(),
      goals: [...goals(2), { description: "   " }],
    });

    const result = await useCase.execute(pdiRequest);

    expect(result).toEqual({ ok: false, error: "AI_INVALID_OUTPUT" });
  });

  it("returns AI_INVALID_OUTPUT when the service throws AiInvalidOutputError", async () => {
    (aiService.generateDraft as any).mockRejectedValue(new AiInvalidOutputError());

    const result = await useCase.execute(pdiRequest);

    expect(result).toEqual({ ok: false, error: "AI_INVALID_OUTPUT" });
  });

  it("returns AI_GENERATION_FAILED when the service throws", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    (aiService.generateDraft as any).mockRejectedValue(
      Object.assign(new Error("503 overloaded"), { status: 503 })
    );

    const result = await useCase.execute(pdiRequest);

    expect(result).toEqual({ ok: false, error: "AI_GENERATION_FAILED" });
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain("overloaded");
    consoleError.mockRestore();
  });

  it("truncates texts over the limits", async () => {
    (aiService.generateDraft as any).mockResolvedValue({
      title: "t".repeat(200),
      generalObjective: "o".repeat(2500),
      rationale: "r".repeat(1500),
      goals: [
        { description: "d".repeat(600), successCriterion: "c".repeat(600) },
        ...goals(2),
      ],
    });

    const result = await useCase.execute(pdiRequest);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.title).toHaveLength(120);
    expect(result.value.generalObjective).toHaveLength(2000);
    expect(result.value.rationale).toHaveLength(1000);
    expect(result.value.goals[0].description).toHaveLength(500);
    expect(result.value.goals[0].successCriterion).toHaveLength(500);
  });

  it("computes the PDI dates on the server (6 months)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 02:00 UTC de 31/01 ainda é 30/01 em São Paulo.
    vi.setSystemTime(new Date("2026-01-31T02:00:00.000Z"));

    const result = await useCase.execute(pdiRequest);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      type: PlanType.PDI,
      suggestedStartDate: "2026-01-30",
      suggestedEndDate: "2026-07-30",
      suggestedNextReviewDate: "2026-02-28",
    });
    expect(result.value.goals).toHaveLength(4);
  });

  it("uses sessionDate for the PE dates, without review date", async () => {
    const result = await useCase.execute(peRequest);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.type).toBe(PlanType.PE);
    expect(result.value.suggestedStartDate).toBe("2026-11-05");
    expect(result.value.suggestedEndDate).toBe("2026-11-05");
    expect(result.value.suggestedNextReviewDate).toBeUndefined();
    expect(lastContext().durationMonths).toBeUndefined();
  });

  it("sends the parent PDI goals in the PE context", async () => {
    const pdi = makePdi(educatorId, student.id);
    (planRepository.findById as any).mockResolvedValue(pdi);

    const result = await useCase.execute({ ...peRequest, parentPlanId: pdi.id.value });

    expect(result.ok).toBe(true);
    expect(lastContext().context.parentGoals).toEqual([
      { description: "Ler sílabas simples", successCriterion: "8 de 10" },
    ]);
  });

  it("returns INVALID_PARENT_PLAN when the parent is a PDI of another student", async () => {
    const otherStudent = makeStudent(educatorId);
    const pdi = makePdi(educatorId, otherStudent.id);
    (planRepository.findById as any).mockResolvedValue(pdi);
    (studentRepository.getById as any).mockImplementation(async (id: Uuid) =>
      id.value === otherStudent.id.value ? otherStudent : student
    );

    const result = await useCase.execute({ ...peRequest, parentPlanId: pdi.id.value });

    expect(result).toEqual({ ok: false, error: "INVALID_PARENT_PLAN" });
    expect(aiService.generateDraft).not.toHaveBeenCalled();
  });

  it("returns PLAN_NOT_FOUND when the parent plan does not exist", async () => {
    (planRepository.findById as any).mockResolvedValue(null);

    const result = await useCase.execute({
      ...peRequest,
      parentPlanId: Uuid.random().value,
    });

    expect(result).toEqual({ ok: false, error: "PLAN_NOT_FOUND" });
  });

  it("returns TEMPLATE_NOT_FOUND for a template of another educator", async () => {
    const template = makeTemplate(Uuid.random());
    (templateRepository.findById as any).mockResolvedValue(template);

    const result = await useCase.execute({
      ...pdiRequest,
      includeAnamnesisTemplateId: template.id.value,
    });

    expect(result).toEqual({ ok: false, error: "TEMPLATE_NOT_FOUND" });
    expect(aiService.generateDraft).not.toHaveBeenCalled();
  });

  it("returns UNAUTHORIZED for a student of another educator", async () => {
    const result = await useCase.execute({ ...pdiRequest, educatorId: Uuid.random() });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(aiService.generateDraft).not.toHaveBeenCalled();
  });

  it("returns STUDENT_NOT_FOUND when the student does not exist", async () => {
    (studentRepository.getById as any).mockResolvedValue(null);

    const result = await useCase.execute(pdiRequest);

    expect(result).toEqual({ ok: false, error: "STUDENT_NOT_FOUND" });
  });
});

describe("generatePlanDraftSchema", () => {
  const base = {
    studentId: Uuid.random().value,
    focus: "Leitura",
    consideredDifficulties: ["troca de letras"],
  };

  it("requires durationMonths on PDI", () => {
    expect(generatePlanDraftSchema.safeParse({ ...base, type: "PDI" }).success).toBe(false);
    expect(
      generatePlanDraftSchema.safeParse({ ...base, type: "PDI", durationMonths: 4 }).success
    ).toBe(false);
    expect(
      generatePlanDraftSchema.safeParse({ ...base, type: "PDI", durationMonths: 6 }).success
    ).toBe(true);
  });

  it("requires sessionDate on PE", () => {
    expect(generatePlanDraftSchema.safeParse({ ...base, type: "PE" }).success).toBe(false);
    expect(
      generatePlanDraftSchema.safeParse({ ...base, type: "PE", sessionDate: "2026-11-05" })
        .success
    ).toBe(true);
  });

  it("requires at least one considered difficulty", () => {
    expect(
      generatePlanDraftSchema.safeParse({
        ...base,
        type: "PDI",
        durationMonths: 3,
        consideredDifficulties: [],
      }).success
    ).toBe(false);
  });
});
