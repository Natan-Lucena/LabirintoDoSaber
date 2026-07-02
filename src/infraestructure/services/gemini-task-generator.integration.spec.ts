import "dotenv/config";
import { describe, it, expect } from "vitest";
import { GeminiTaskGeneratorImpl } from "./gemini-task-generator-impl";
import { TaskCategory } from "../../domain/entities/task";

const hasApiKey = !!process.env.GEMINI_API_KEY;

// Teste de integração REAL: chama a API do Gemini usando a GEMINI_API_KEY do .env.
// Pula automaticamente se a chave não estiver presente (ex.: CI sem segredo).
describe.skipIf(!hasApiKey)("GeminiTaskGeneratorImpl (integração)", () => {
  it(
    "gera 1 atividade a partir da API real do Gemini",
    async () => {
      const generator = new GeminiTaskGeneratorImpl();

      const drafts = await generator.generate({
        targetAudience: "Criança de 8 anos aprendendo a ler",
        instructions: "Uma atividade simples de reconhecimento de vogais",
        quantity: 1,
        category: TaskCategory.Reading,
      });

      // Inspeção manual do que o Gemini devolveu.
      console.log(JSON.stringify(drafts, null, 2));

      expect(Array.isArray(drafts)).toBe(true);
      expect(drafts.length).toBeGreaterThanOrEqual(1);

      const [draft] = drafts;
      expect(typeof draft.prompt).toBe("string");
      expect(draft.prompt.length).toBeGreaterThan(0);
      expect(draft.alternatives.length).toBeGreaterThanOrEqual(2);
      expect(draft.alternatives.filter((alt) => alt.isCorrect)).toHaveLength(1);
    },
    60000
  );
});
