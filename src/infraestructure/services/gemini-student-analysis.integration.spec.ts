import "dotenv/config";
import { describe, it, expect } from "vitest";
import { GeminiStudentAnalysisImpl } from "./gemini-student-analysis-impl";
import { StudentAnalysisAiInput } from "../../domain/services/ai-student-analysis-service";

const hasApiKey = !!process.env.GEMINI_API_KEY;

const input: StudentAnalysisAiInput = {
  student: {
    name: "João",
    age: 8,
    gender: "male",
    learningTopics: ["leitura", "consciência fonológica"],
  },
  metrics: {
    total: { total: 10, correct: 6, accuracy: 0.6 },
    categories: [
      { category: "reading", total: 5, correct: 4, accuracy: 0.8 },
      { category: "writing", total: 5, correct: 2, accuracy: 0.4 },
    ],
  },
  sessions: [
    {
      name: "Sessão 1",
      startedAt: "2026-06-01T10:00:00.000Z",
      finishedAt: "2026-06-01T10:20:00.000Z",
      observation: "Estava atento, mas cansou no fim.",
      totalAnswers: 5,
      correctAnswers: 3,
      averageTimeToAnswer: 15,
      answers: [
        {
          taskPrompt: "Qual palavra rima com 'gato'?",
          category: "reading",
          isCorrect: true,
          timeToAnswer: 10,
        },
        {
          taskPrompt: "Complete: ca__",
          category: "writing",
          isCorrect: false,
          timeToAnswer: 25,
        },
      ],
    },
  ],
};

// Teste de integração REAL: chama a API do Gemini usando a GEMINI_API_KEY do .env.
describe.skipIf(!hasApiKey)("GeminiStudentAnalysisImpl (integração)", () => {
  it(
    "gera uma análise textual extensa a partir da API real do Gemini",
    async () => {
      const service = new GeminiStudentAnalysisImpl();

      const analysis = await service.generate(input);

      console.log(analysis);

      expect(typeof analysis).toBe("string");
      // O texto deve ser propositalmente extenso e rico.
      expect(analysis.length).toBeGreaterThan(500);
      // Deve conter as seções pedidas no prompt.
      expect(analysis).toContain("Guia de Intervenção");
    },
    60000
  );
});
