import { describe, it, expect, vi, beforeEach } from "vitest";
import { success, failure, Uuid } from "@wave-telecom/framework/core";
import { GenerateStudentAiAnalysisUseCase } from "./generate-student-ai-analysis-use-case";
import { GenerateStudentAnalysisUseCase } from "../generate-student-analisys/generate-student-analisys-use-case";
import { AnamneseTemplateRepository } from "../../../../../domain/repositories/anamnese-template-repository";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";
import { AiStudentAnalysisService } from "../../../../../domain/services/ai-student-analysis-service";
import { TaskCategory } from "../../../../../domain/entities/task";

const studentId = Uuid.random().value;
const taskId = Uuid.random();

const fakeStudent = {
  name: "João",
  age: 8,
  gender: "male",
  learningTopics: ["leitura"],
} as any;

const fakeTask = {
  id: taskId,
  prompt: "Qual é a vogal?",
  category: TaskCategory.Reading,
};

const rawAnalysisValue = {
  student: fakeStudent,
  taskById: new Map([[taskId.value, fakeTask]]),
  categories: {
    [TaskCategory.Reading]: {
      category: TaskCategory.Reading,
      total: 2,
      correct: 1,
      accuracy: 0.5,
    },
  },
  total: { total: 2, correct: 1, accuracy: 0.5 },
  sessions: [
    {
      id: Uuid.random(),
      name: "Sessão 1",
      startedAt: new Date("2026-06-01T10:00:00.000Z"),
      finishedAt: new Date("2026-06-01T10:20:00.000Z"),
      observation: "Atento",
      answers: [
        { taskId, isCorrect: true, timeToAnswer: 12 },
        { taskId, isCorrect: false, timeToAnswer: 20 },
      ],
    },
  ],
} as any;

const mockGenerate = (): GenerateStudentAnalysisUseCase =>
  ({ loadAnalysisData: vi.fn() } as unknown as GenerateStudentAnalysisUseCase);

const mockTemplateRepo = (): AnamneseTemplateRepository =>
  ({ findById: vi.fn() } as unknown as AnamneseTemplateRepository);

const mockResponseRepo = (): AnamneseResponseRepository =>
  ({ listByStudentId: vi.fn() } as unknown as AnamneseResponseRepository);

const mockAiService = (): AiStudentAnalysisService =>
  ({ generate: vi.fn() } as unknown as AiStudentAnalysisService);

describe("GenerateStudentAiAnalysisUseCase", () => {
  let generate: GenerateStudentAnalysisUseCase;
  let templateRepo: AnamneseTemplateRepository;
  let responseRepo: AnamneseResponseRepository;
  let aiService: AiStudentAnalysisService;
  let useCase: GenerateStudentAiAnalysisUseCase;

  beforeEach(() => {
    generate = mockGenerate();
    templateRepo = mockTemplateRepo();
    responseRepo = mockResponseRepo();
    aiService = mockAiService();
    useCase = new GenerateStudentAiAnalysisUseCase(
      generate,
      templateRepo,
      responseRepo,
      aiService
    );

    (generate.loadAnalysisData as any).mockResolvedValue(
      success(rawAnalysisValue)
    );
    (aiService.generate as any).mockResolvedValue("Análise extensa...");
  });

  it("propagates failure when the metrics use-case fails", async () => {
    (generate.loadAnalysisData as any).mockResolvedValue(
      failure("STUDENT_NOT_FOUND")
    );

    const result = await useCase.execute({ studentId });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("STUDENT_NOT_FOUND");
    expect(aiService.generate).not.toHaveBeenCalled();
  });

  it("builds a rich input and returns the AI analysis text", async () => {
    const result = await useCase.execute({ studentId });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.analysis).toBe("Análise extensa...");

    const input = (aiService.generate as any).mock.calls[0][0];
    expect(input.student.name).toBe("João");
    expect(input.metrics.total.total).toBe(2);
    expect(input.sessions).toHaveLength(1);
    expect(input.sessions[0].correctAnswers).toBe(1);
    expect(input.sessions[0].averageTimeToAnswer).toBe(16);
    expect(input.sessions[0].answers[0].taskPrompt).toBe("Qual é a vogal?");
    expect(input.anamnese).toBeUndefined();
  });

  it("does not call loadAnalysisData more than once (no redundant fetch)", async () => {
    await useCase.execute({ studentId });

    expect(generate.loadAnalysisData as any).toHaveBeenCalledTimes(1);
  });

  it("returns AI_ANALYSIS_FAILED when the AI service throws", async () => {
    (aiService.generate as any).mockRejectedValue(new Error("boom"));

    const result = await useCase.execute({ studentId });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe("AI_ANALYSIS_FAILED");
  });

  it("includes anamnese data when a templateId is provided", async () => {
    const templateId = Uuid.random().value;
    (templateRepo.findById as any).mockResolvedValue({
      title: "Anamnese Inicial",
      questions: [
        { id: "q1", text: "Como dorme?", options: [] },
        {
          id: "q2",
          text: "Nível de atenção?",
          options: [{ id: "o1", text: "Alto" }],
        },
      ],
    });
    (responseRepo.listByStudentId as any).mockResolvedValue([
      {
        templateId: new Uuid(templateId),
        answers: [
          { questionId: "q1", textValue: "Bem" },
          { questionId: "q2", selectedOptionId: "o1" },
        ],
      },
    ]);

    const result = await useCase.execute({ studentId, templateId });

    expect(result.ok).toBe(true);
    const input = (aiService.generate as any).mock.calls[0][0];
    expect(input.anamnese.templateTitle).toBe("Anamnese Inicial");
    expect(input.anamnese.answers).toEqual([
      { question: "Como dorme?", answer: "Bem" },
      { question: "Nível de atenção?", answer: "Alto" },
    ]);
  });

  // --- regressão: sem refetch redundante de student/tasks -------
  //
  // Antes da otimização, este use case chamava studentRepository.getById()
  // de novo (o GenerateStudentAnalysisUseCase já tinha buscado o mesmo
  // student) e refazia a busca de tasks (mesmo com cache, sequencial por
  // task única). Agora reaproveita student/taskById que
  // loadAnalysisData() já resolveu — nenhum repositório extra é injetado
  // pra isso.
  describe("no redundant student/task fetch (regression)", () => {
    it("builds session summaries purely from the data loadAnalysisData already resolved", async () => {
      const result = await useCase.execute({ studentId });

      expect(result.ok).toBe(true);
      // loadAnalysisData é a ÚNICA fonte de student/tasks; não há
      // studentRepository/taskRepository injetados neste use case.
      expect(generate.loadAnalysisData as any).toHaveBeenCalledWith({
        studentId,
        startDate: undefined,
        endDate: undefined,
        limit: undefined,
      });
    });

    it("runs buildAnamnese concurrently with loadAnalysisData instead of sequentially", async () => {
      const templateId = Uuid.random().value;
      const callOrder: string[] = [];

      (generate.loadAnalysisData as any).mockImplementation(async () => {
        callOrder.push("loadAnalysisData:start");
        await new Promise((r) => setTimeout(r, 10));
        callOrder.push("loadAnalysisData:end");
        return success(rawAnalysisValue);
      });
      (templateRepo.findById as any).mockImplementation(async () => {
        callOrder.push("buildAnamnese:start");
        return { title: "Anamnese", questions: [] };
      });
      (responseRepo.listByStudentId as any).mockResolvedValue([]);

      await useCase.execute({ studentId, templateId });

      // buildAnamnese começa ANTES de loadAnalysisData terminar — prova
      // que rodam em paralelo (Promise.all), não em sequência.
      const templateStartIndex = callOrder.indexOf("buildAnamnese:start");
      const loadEndIndex = callOrder.indexOf("loadAnalysisData:end");
      expect(templateStartIndex).toBeLessThan(loadEndIndex);
    });
  });
});
