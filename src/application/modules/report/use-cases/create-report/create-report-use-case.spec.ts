import { describe, it, expect, beforeEach, vi } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import {
  Report,
  ReportAudience,
  ReportSection,
  ReportType,
} from "../../../../../domain/entities/report";
import { TaskCategory } from "../../../../../domain/entities/task";
import { Plan, PlanSource, PlanType } from "../../../../../domain/entities/plan";
import { AiClinicalService } from "../../../../../domain/services/ai-clinical-service";
import { GenerateStudentAnalysisUseCase } from "../../../task-notebook-session/use-cases/generate-student-analisys/generate-student-analisys-use-case";
import { ReportContentBuilder } from "../../report-content-builder";
import { GetReportUseCase } from "../get-report/get-report-use-case";
import { CreateReportUseCase, CreateReportUseCaseRequest } from "./create-report-use-case";
import {
  makeAnamneseResponseRepository,
  makeAnamneseWithSummary,
  makeAnsweredSession,
  makeApplicationRepository,
  makeCompletedApplication,
  demoAnswers,
  makeDemoTemplate,
  makeEvolution,
  makeEvolutionRepository,
  makePdi,
  makePlanRepository,
  makeReportRepository,
  makeSensitiveStudent,
  makeSessionRepository,
  makeStudent,
  makeStudentRepository,
  makeTask,
  makeTaskRepository,
  PERIOD,
  PROFESSIONAL,
  SENSITIVE,
  sessionDateOf,
  unwrap,
} from "../test-fixtures";
import { makeTemplateRepository } from "../../../scale-application/use-cases/test-fixtures";

const SYNTHESIS = "No período, a criança avançou na leitura de sílabas.";

describe("CreateReportUseCase", () => {
  const educatorId = Uuid.random();
  const student = makeSensitiveStudent(educatorId);
  const otherStudent = makeStudent(Uuid.random(), "Caio");
  const emptyStudent = makeStudent(educatorId, "Bia");
  // Só tem síntese de anamnese, nada no período.
  const anamneseOnlyStudent = makeStudent(educatorId, "Duda");

  // PDI ativo com vigência depois do período.
  const futurePdi = (studentId: Uuid) =>
    unwrap<Plan>(
      Plan.create({
        educatorId,
        studentId,
        type: PlanType.PDI,
        source: PlanSource.MANUAL,
        title: "PDI futuro",
        generalObjective: "Ler textos curtos",
        startDate: "2027-01-01",
        endDate: "2027-06-01",
        goals: [{ description: "Ler frases" }],
      })
    );

  const readingTask = makeTask(TaskCategory.Reading);
  const writingTask = makeTask(TaskCategory.Writing);
  const template = makeDemoTemplate();

  // Sessões: duas finalizadas no período, uma aberta e uma fora do período.
  const sessionA = makeAnsweredSession(
    student,
    new Date("2026-11-05T13:00:00.000Z"),
    readingTask,
    [true, true, true, false]
  );
  const sessionB = makeAnsweredSession(
    student,
    new Date("2026-11-20T13:00:00.000Z"),
    writingTask,
    [true, false]
  );
  const openSession = makeAnsweredSession(
    student,
    new Date("2026-11-21T13:00:00.000Z"),
    readingTask,
    [false, false],
    false
  );
  const oldSession = makeAnsweredSession(
    student,
    new Date("2026-09-10T13:00:00.000Z"),
    readingTask,
    [false]
  );

  let reportRepository: ReturnType<typeof makeReportRepository>;
  let evolutionRepository: ReturnType<typeof makeEvolutionRepository>;
  let applicationRepository: ReturnType<typeof makeApplicationRepository>;
  let aiClinicalService: { [K in keyof AiClinicalService]: ReturnType<typeof vi.fn> };
  let useCase: CreateReportUseCase;
  let studentRepository: ReturnType<typeof makeStudentRepository>;

  const request = (
    overrides: Partial<CreateReportUseCaseRequest> = {}
  ): CreateReportUseCaseRequest => ({
    educatorId,
    professional: PROFESSIONAL,
    studentId: student.id.value,
    type: ReportType.PROGRESS,
    audience: ReportAudience.FAMILY,
    period: PERIOD,
    sections: [
      ReportSection.PATIENT_DATA,
      ReportSection.SESSION_METRICS,
      ReportSection.EVOLUTIONS,
      ReportSection.PLAN_PROGRESS,
      ReportSection.AI_SYNTHESIS,
    ],
    ...overrides,
  });

  beforeEach(() => {
    const pdi = makePdi(educatorId, student.id, "PDI de leitura");
    studentRepository = makeStudentRepository([
      student,
      otherStudent,
      emptyStudent,
      anamneseOnlyStudent,
    ]);
    reportRepository = makeReportRepository();
    evolutionRepository = makeEvolutionRepository([
      makeEvolution(sessionA, "Leu sílabas com apoio visual.", pdi),
      makeEvolution(oldSession, "Registro de setembro."),
    ]);
    applicationRepository = makeApplicationRepository([
      makeCompletedApplication(template, student, new Date("2026-11-15T15:00:00.000Z")),
      makeCompletedApplication(template, student, new Date("2026-08-15T15:00:00.000Z")),
    ]);
    aiClinicalService = {
      nextSessionSuggestion: vi.fn(),
      scaleInsight: vi.fn(),
      anamneseSummary: vi.fn(),
      reportSynthesis: vi.fn().mockResolvedValue({ text: SYNTHESIS }),
    };

    const builder = new ReportContentBuilder({
      analysisUseCase: new GenerateStudentAnalysisUseCase(
        studentRepository,
        makeSessionRepository([sessionA, sessionB, openSession, oldSession]),
        makeTaskRepository([readingTask, writingTask])
      ),
      evolutionRepository,
      planRepository: makePlanRepository([
        pdi,
        futurePdi(student.id),
        futurePdi(emptyStudent.id),
      ]),
      applicationRepository,
      templateRepository: makeTemplateRepository([template]),
      anamneseResponseRepository: makeAnamneseResponseRepository([
        makeAnamneseWithSummary(student, "- Queixa: troca letras", new Date("2026-06-01")),
        makeAnamneseWithSummary(student, "- Queixa: leitura lenta", new Date("2026-10-01")),
        makeAnamneseWithSummary(anamneseOnlyStudent, "- Queixa: atenção", new Date("2026-10-01")),
      ]),
    });

    useCase = new CreateReportUseCase(
      reportRepository,
      studentRepository,
      builder,
      aiClinicalService
    );
  });

  it("should create a progress report with the frozen content of the period", async () => {
    const report = unwrap<Report>(await useCase.execute(request()));

    expect(reportRepository.save).toHaveBeenCalledWith(report);
    expect(report.studentName).toBe(SENSITIVE.name);
    expect(report.synthesisFailed).toBe(false);
    expect(report.shares).toEqual([]);
    expect(report.content).toMatchObject({
      title: "Relatório de progresso",
      professional: PROFESSIONAL,
      // RP-02: nome completo, e a idade.
      patient: { displayName: SENSITIVE.name, ageYears: 7 },
      // Só as duas sessões finalizadas no período; acurácia em fração.
      sessionMetrics: {
        sessions: 2,
        answered: 6,
        accuracy: 4 / 6,
        byCategory: [
          { category: TaskCategory.Reading, accuracy: 0.75 },
          { category: TaskCategory.Writing, accuracy: 0.5 },
        ],
      },
      evolutions: [
        {
          sessionDate: sessionDateOf(sessionA),
          planTitle: "PDI de leitura",
          achieved: 1,
          total: 2,
          record: "Leu sílabas com apoio visual.",
        },
      ],
      planProgress: [
        {
          title: "PDI de leitura",
          type: "PDI",
          percent: 0,
          goals: [
            { description: "Ler sílabas", status: "NOT_STARTED" },
            { description: "Ler palavras", status: "NOT_STARTED" },
          ],
        },
      ],
      synthesis: SYNTHESIS,
    });
    // Um único instante para a geração do conteúdo e a criação.
    expect(report.content.generatedAt).toBe(report.createdAt.toISOString());
    // Seções fora do pedido não entram.
    expect(report.content).not.toHaveProperty("assessments");
    expect(report.content).not.toHaveProperty("anamnesisSummary");
  });

  it("should never put address, phones, documents or guardian data in the content or the AI input (RP-01, BE-RP-03)", async () => {
    const report = unwrap<Report>(await useCase.execute(request()));

    const content = JSON.stringify(report.content);
    const aiInput = JSON.stringify(aiClinicalService.reportSynthesis.mock.calls[0][0]);

    for (const serialized of [content, aiInput]) {
      for (const value of [
        SENSITIVE.phone,
        SENSITIVE.zipcode,
        SENSITIVE.road,
        SENSITIVE.photoUrl,
        SENSITIVE.documentUrl,
        SENSITIVE.documentName,
        SENSITIVE.guardianName,
        SENSITIVE.guardianPhone,
        SENSITIVE.guardianRelationship,
      ]) {
        expect(serialized).not.toContain(value);
      }
      for (const key of [
        "phonenumber",
        "road",
        "zipcode",
        "housenumber",
        "documents",
        "photoUrl",
        "guardianName",
        "guardianPhone",
        "cpf",
      ]) {
        expect(serialized).not.toContain(`"${key}"`);
      }
    }

    // O nome vai no documento, mas não ao provedor de IA (IA-05).
    expect(content).toContain(SENSITIVE.name);
    expect(aiInput).not.toContain(SENSITIVE.name);
    expect(aiInput).not.toContain(PROFESSIONAL.name);
  });

  it("should send the audience and only the requested sections to the AI", async () => {
    await useCase.execute(request({ audience: ReportAudience.SCHOOL }));

    const params = aiClinicalService.reportSynthesis.mock.calls[0][0];
    expect(params).toMatchObject({
      audience: ReportAudience.SCHOOL,
      reportType: ReportType.PROGRESS,
      period: PERIOD,
      student: { age: 7, gender: "male" },
      sessionMetrics: { sessions: 2 },
    });
    expect(params).not.toHaveProperty("patient");
    expect(params).not.toHaveProperty("assessments");
    expect(params).not.toHaveProperty("anamnesisSummary");
  });

  it("should build an assessment report with the scores and the latest anamnese summary", async () => {
    const report = unwrap<Report>(
      await useCase.execute(
        request({
          type: ReportType.ASSESSMENT,
          audience: ReportAudience.PROFESSIONAL,
          sections: [ReportSection.ASSESSMENTS, ReportSection.ANAMNESIS_SUMMARY],
        })
      )
    );

    // Escore derivado com o template da versão gravada (fase de escalas).
    const score = template.computeScore(demoAnswers([1, 1, 1, 1, 0, 0, 0, 0]));
    expect(applicationRepository.search).toHaveBeenCalledWith(
      expect.objectContaining({ status: "COMPLETED" })
    );
    // Só a aplicação concluída dentro do período.
    expect(report.content.assessments).toEqual([
      {
        templateName: template.name,
        completedAt: "2026-11-15T15:00:00.000Z",
        value: score.value,
        max: score.max,
        band: score.band?.label,
      },
    ]);
    expect(score.band).toBeDefined();
    expect(report.content.anamnesisSummary).toBe("- Queixa: leitura lenta");
    expect(report.content).not.toHaveProperty("patient");
    expect(report.content).not.toHaveProperty("synthesis");
    expect(aiClinicalService.reportSynthesis).not.toHaveBeenCalled();
  });

  it("should keep the sections in the order of the type and without repetition", async () => {
    const report = unwrap<Report>(
      await useCase.execute(
        request({
          sections: [
            ReportSection.EVOLUTIONS,
            ReportSection.PATIENT_DATA,
            ReportSection.EVOLUTIONS,
          ],
        })
      )
    );

    expect(report.sections).toEqual([ReportSection.PATIENT_DATA, ReportSection.EVOLUTIONS]);
  });

  it("should create the report without synthesis when the AI fails (RP-06, BE-RP-05)", async () => {
    aiClinicalService.reportSynthesis.mockRejectedValue(new Error("boom"));

    const result = await useCase.execute(request());

    const report = unwrap<Report>(result);
    expect(report.synthesisFailed).toBe(true);
    expect(report.content).not.toHaveProperty("synthesis");
    expect(report.content.evolutions).toHaveLength(1);
    expect(reportRepository.save).toHaveBeenCalledWith(report);
  });

  it("should mark the synthesis as failed when the AI returns an empty text", async () => {
    aiClinicalService.reportSynthesis.mockResolvedValue({ text: "   " });

    const report = unwrap<Report>(await useCase.execute(request()));

    expect(report.synthesisFailed).toBe(true);
    expect(report.content).not.toHaveProperty("synthesis");
  });

  it("should clip the synthesis to 2500 characters", async () => {
    aiClinicalService.reportSynthesis.mockResolvedValue({ text: "a".repeat(3000) });

    const report = unwrap<Report>(await useCase.execute(request()));

    expect(report.content.synthesis).toHaveLength(2500);
  });

  it("should not call the AI without the AI_SYNTHESIS section", async () => {
    const report = unwrap<Report>(
      await useCase.execute(request({ sections: [ReportSection.EVOLUTIONS] }))
    );

    expect(aiClinicalService.reportSynthesis).not.toHaveBeenCalled();
    expect(report.synthesisFailed).toBe(false);
  });

  it("should keep the stored content when an evolution is edited later (RP-03, BE-RP-04)", async () => {
    const report = unwrap<Report>(await useCase.execute(request()));

    const [evolution] = [...evolutionRepository.store.values()].filter(
      (item) => item.sessionId.value === sessionA.id.value
    );
    const edited = unwrap(evolution.update({ descriptiveRecord: "Registro reescrito." }));
    await evolutionRepository.save(edited);

    const getReport = new GetReportUseCase(reportRepository, studentRepository);
    const stored = unwrap<Report>(
      await getReport.execute({ educatorId, reportId: report.id.value })
    );

    expect(stored.content.evolutions?.[0].record).toBe("Leu sílabas com apoio visual.");
  });

  it("should return SECTION_NOT_ALLOWED for a section outside the type (RP-04, BE-RP-02)", async () => {
    const result = await useCase.execute(
      request({ sections: [ReportSection.PATIENT_DATA, ReportSection.ASSESSMENTS] })
    );

    expect(result).toEqual({ ok: false, error: "SECTION_NOT_ALLOWED" });
    expect(reportRepository.save).not.toHaveBeenCalled();
  });

  it("should return INVALID_PERIOD for an inverted or too long period", async () => {
    expect(
      await useCase.execute(request({ period: { from: "2026-11-30", to: "2026-11-01" } }))
    ).toEqual({ ok: false, error: "INVALID_PERIOD" });
    expect(
      await useCase.execute(request({ period: { from: "2025-01-01", to: "2026-11-30" } }))
    ).toEqual({ ok: false, error: "INVALID_PERIOD" });
    expect(reportRepository.save).not.toHaveBeenCalled();
  });

  it("should return REPORT_EMPTY_PERIOD without sessions, evolutions, plans, assessments or anamnese (RP-05, BE-RP-02)", async () => {
    // O aluno tem um PDI ativo, mas com vigência fora do período.
    const result = await useCase.execute(request({ studentId: emptyStudent.id.value }));

    expect(result).toEqual({ ok: false, error: "REPORT_EMPTY_PERIOD" });
    expect(aiClinicalService.reportSynthesis).not.toHaveBeenCalled();
    expect(reportRepository.save).not.toHaveBeenCalled();
  });

  it("should leave out an active plan whose validity is outside the period", async () => {
    const report = unwrap<Report>(
      await useCase.execute(request({ sections: [ReportSection.PLAN_PROGRESS] }))
    );

    expect(report.content.planProgress?.map((plan) => plan.title)).toEqual(["PDI de leitura"]);
  });

  it("should return REPORT_EMPTY_PERIOD when no requested section has data, even with sessions in the period", async () => {
    // Sessão em 20/11, mas nenhuma aplicação concluída entre 16 e 30/11.
    const result = await useCase.execute(
      request({
        type: ReportType.ASSESSMENT,
        sections: [ReportSection.ASSESSMENTS, ReportSection.AI_SYNTHESIS],
        period: { from: "2026-11-16", to: "2026-11-30" },
      })
    );

    expect(result).toEqual({ ok: false, error: "REPORT_EMPTY_PERIOD" });
    expect(aiClinicalService.reportSynthesis).not.toHaveBeenCalled();
    expect(reportRepository.save).not.toHaveBeenCalled();
  });

  it("should not create a progress report backed only by the anamnese summary", async () => {
    const result = await useCase.execute(
      request({ studentId: anamneseOnlyStudent.id.value })
    );

    expect(result).toEqual({ ok: false, error: "REPORT_EMPTY_PERIOD" });
    expect(aiClinicalService.reportSynthesis).not.toHaveBeenCalled();
    expect(reportRepository.save).not.toHaveBeenCalled();
  });

  it("should return UNAUTHORIZED for a student of another educator", async () => {
    const result = await useCase.execute(request({ studentId: otherStudent.id.value }));

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(reportRepository.save).not.toHaveBeenCalled();
  });

  it("should return STUDENT_NOT_FOUND for a missing student", async () => {
    const result = await useCase.execute(request({ studentId: Uuid.random().value }));

    expect(result).toEqual({ ok: false, error: "STUDENT_NOT_FOUND" });
  });
});
