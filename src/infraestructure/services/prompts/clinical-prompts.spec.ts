import { describe, it, expect } from "vitest";
import { CriterionResult } from "../../../domain/entities/session-evolution";
import { BandSeverity, ScoringMethod } from "../../../domain/entities/scale-template";
import { ScaleInsightParams } from "../../../domain/services/ai-clinical-service";
import { buildAnamneseSummaryPrompt } from "./anamnese-summary-prompt";
import { buildNextSessionSuggestionPrompt } from "./next-session-suggestion-prompt";
import { buildScaleInsightPrompt } from "./scale-insight-prompt";
import { buildReportSynthesisPrompt } from "./report-synthesis-prompt";
import { ReportAudience, ReportType } from "../../../domain/entities/report";

const student = { age: 8, gender: "female" };

const insightParams = (preliminary: boolean): ScaleInsightParams => ({
  student,
  scale: {
    name: "Escala",
    method: ScoringMethod.SUM,
    bands: [{ min: 0, max: 8, label: "Baixa", severity: BandSeverity.LOW }],
  },
  score: { partial: preliminary, answered: 4, total: 8, value: 3, max: 24, subscales: [] },
  preliminary,
});

const reportPrompt = (audience: ReportAudience) =>
  buildReportSynthesisPrompt({
    student,
    audience,
    reportType: ReportType.PROGRESS,
    period: { from: "2026-08-01", to: "2026-10-31" },
    sessionMetrics: { sessions: 4, answered: 20, accuracy: 0.75, byCategory: [] },
  });

const prompts = {
  nextSession: buildNextSessionSuggestionPrompt({
    student,
    session: { durationMinutes: 40, answeredCount: 3, correctCount: 2 },
    criteria: [{ description: "Ler sílabas", result: CriterionResult.ACHIEVED }],
    recentEvolutions: [],
  }),
  insight: buildScaleInsightPrompt(insightParams(false)),
  summary: buildAnamneseSummaryPrompt({
    student,
    anamnese: { answers: [{ question: "Queixa", answer: "Troca letras" }] },
  }),
  report: reportPrompt(ReportAudience.PROFESSIONAL),
};

describe("clinical prompts (IA-02, IA-04)", () => {
  it.each(Object.entries(prompts))(
    "%s asks for Portuguese, no diagnosis and no promise of results",
    (_, prompt) => {
      expect(prompt).toContain("português do Brasil");
      expect(prompt).toContain("NÃO faça diagnóstico");
      expect(prompt).toContain("NÃO prometa resultados");
      expect(prompt).toContain("sugestão para o profissional revisar");
      expect(prompt).toContain("SOMENTE com um objeto JSON");
    }
  );

  it("marks the insight of a draft as preliminary", () => {
    const draft = buildScaleInsightPrompt(insightParams(true));
    expect(draft).toContain("preliminar");
    expect(draft).toContain("pode subestimar o resultado");
    expect(prompts.insight).not.toContain("RASCUNHO");
  });

  it("asks for the anamnese topics", () => {
    expect(prompts.summary).toContain(
      "Histórico, Queixa, Desenvolvimento, Escola, Pontos de atenção"
    );
  });

  it("adapts the report synthesis language to the audience", () => {
    expect(reportPrompt(ReportAudience.FAMILY)).toContain("linguagem simples");
    expect(reportPrompt(ReportAudience.SCHOOL)).toContain("ESCOLA");
    expect(prompts.report).toContain("linguagem técnica");
    expect(prompts.report).not.toContain("linguagem simples");
    expect(prompts.report).toContain("2500 caracteres");
  });
});
