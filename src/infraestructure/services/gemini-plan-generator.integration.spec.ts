import "dotenv/config";
import { describe, it, expect } from "vitest";
import { GeminiPlanGeneratorImpl } from "./gemini-plan-generator-impl";
import { PlanType } from "../../domain/entities/plan";

const hasApiKey = !!process.env.GEMINI_API_KEY;

// Teste de integração REAL: chama a API do Gemini usando a GEMINI_API_KEY do .env.
describe.skipIf(!hasApiKey)("GeminiPlanGeneratorImpl (integração)", () => {
  it(
    "gera um rascunho de PDI sem histórico de sessões",
    async () => {
      const generator = new GeminiPlanGeneratorImpl();

      const draft = await generator.generateDraft({
        type: PlanType.PDI,
        durationMonths: 3,
        context: {
          student: { age: 8, gender: "male" },
          focus: "Leitura de palavras simples",
          consideredDifficulties: ["troca de letras", "atenção curta"],
          metrics: {
            total: { total: 0, correct: 0, accuracy: 0 },
            categories: [],
          },
          recentObservations: [],
          hasSessionHistory: false,
        },
      });

      console.log(JSON.stringify(draft, null, 2));

      expect(typeof draft.title).toBe("string");
      expect(draft.goals.length).toBeGreaterThanOrEqual(3);
      expect(draft.goals.length).toBeLessThanOrEqual(6);
    },
    60000
  );
});
