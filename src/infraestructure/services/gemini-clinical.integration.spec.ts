import "dotenv/config";
import { describe, it, expect } from "vitest";
import { GeminiClinicalImpl } from "./gemini-clinical-impl";
import { CriterionResult } from "../../domain/entities/session-evolution";
import { BandSeverity, ScoringMethod } from "../../domain/entities/scale-template";

const hasApiKey = !!process.env.GEMINI_API_KEY;

// Termos diagnósticos óbvios que o texto não pode trazer (IA-04).
const DIAGNOSTIC_TERMS =
  /\b(TDAH|autis\w*|TEA|dislexi\w*|discalculi\w*|disgrafi\w*|transtorno\w*|s[ií]ndrome\w*)\b/i;

const student = { age: 8, gender: "male" };

const expectCleanText = (text: string, max: number) => {
  expect(text.trim().length).toBeGreaterThan(0);
  // O use case corta no limite; aqui conferimos que o modelo respeita o pedido
  // com alguma folga.
  expect(text.length).toBeLessThanOrEqual(Math.round(max * 1.2));
  expect(text).not.toMatch(DIAGNOSTIC_TERMS);
};

// Teste de integração REAL: chama a API do Gemini usando a GEMINI_API_KEY do .env.
describe.skipIf(!hasApiKey)("GeminiClinicalImpl (integração)", () => {
  it(
    "sugere a próxima sessão",
    async () => {
      const output = await new GeminiClinicalImpl().nextSessionSuggestion({
        student,
        planGoals: [{ description: "Ler palavras com sílabas simples", successCriterion: "8 de 10" }],
        session: { durationMinutes: 40, answeredCount: 10, correctCount: 6 },
        criteria: [
          {
            description: "Ler palavras com sílabas simples",
            attempts: 10,
            successes: 6,
            result: CriterionResult.PARTIAL,
          },
        ],
        descriptiveRecord: "Leu com apoio visual; trocou p/b em algumas palavras.",
        recentEvolutions: [
          { sessionDate: "2026-11-03", achievedCount: 0, criteriaCount: 1, excerpt: "Leu sílabas isoladas." },
        ],
      });

      expectCleanText(output.suggestion, 1000);
      if (output.rationale) expectCleanText(output.rationale, 500);
    },
    90000
  );

  it(
    "gera o insight de uma escala em rascunho",
    async () => {
      const output = await new GeminiClinicalImpl().scaleInsight({
        student,
        scale: {
          name: "Escala de rastreio de atenção (demonstração)",
          method: ScoringMethod.SUM,
          bands: [
            { min: 0, max: 8, label: "Baixa", severity: BandSeverity.LOW },
            { min: 9, max: 16, label: "Moderada", severity: BandSeverity.MODERATE },
            { min: 17, max: 24, label: "Alta", severity: BandSeverity.HIGH },
          ],
        },
        score: {
          partial: true,
          answered: 5,
          total: 8,
          value: 9,
          max: 24,
          band: { label: "Moderada", severity: BandSeverity.MODERATE },
          subscales: [],
        },
        preliminary: true,
      });

      expectCleanText(output.text, 800);
    },
    90000
  );

  it(
    "resume uma anamnese",
    async () => {
      const output = await new GeminiClinicalImpl().anamneseSummary({
        student,
        anamnese: {
          templateTitle: "Anamnese inicial",
          answers: [
            { question: "Qual a queixa principal?", answer: "Troca letras ao escrever e lê devagar." },
            { question: "Como foi o desenvolvimento da fala?", answer: "Falou as primeiras palavras com 1 ano." },
            { question: "Frequenta escola?", answer: "Sim, 3º ano do ensino fundamental." },
          ],
        },
      });

      expectCleanText(output.text, 1500);
    },
    90000
  );
});
