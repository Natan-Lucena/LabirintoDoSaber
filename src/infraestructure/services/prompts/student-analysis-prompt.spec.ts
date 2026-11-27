import { describe, it, expect } from "vitest";
import { buildStudentAnalysisPrompt } from "./student-analysis-prompt";
import { StudentAnalysisAiInput } from "../../../domain/services/ai-student-analysis-service";

const input = (): StudentAnalysisAiInput => ({
  student: { name: "Aluno", age: 8, gender: "MALE", learningTopics: [] },
  metrics: {
    total: { total: 2, correct: 1, accuracy: 0.5 },
    categories: [],
  },
  sessions: [
    {
      name: "Sessão",
      startedAt: "2026-11-10T13:00:00.000Z",
      finishedAt: "2026-11-10T13:30:00.000Z",
      totalAnswers: 2,
      correctAnswers: 1,
      // Milissegundos, como o app envia.
      averageTimeToAnswer: 2500,
      answers: [
        { taskPrompt: "Leia a sílaba", isCorrect: true, timeToAnswer: 2500 },
        { taskPrompt: "Conte as letras", isCorrect: false, timeToAnswer: 12345 },
        // Resposta antiga, já normalizada para milissegundos (PP-08).
        { taskPrompt: "Ache a rima", isCorrect: true, timeToAnswer: 8000 },
      ],
    },
  ],
});

describe("buildStudentAnalysisPrompt: tempo de resposta", () => {
  it("converte milissegundos para segundos ao escrever o prompt", () => {
    const prompt = buildStudentAnalysisPrompt(input());

    expect(prompt).toContain("tempo médio por questão: 2.5s");
    expect(prompt).toContain("(?, 2.5s) Leia a sílaba");
    expect(prompt).toContain("(?, 12.3s) Conte as letras");
    expect(prompt).not.toContain("2500s");
    expect(prompt).not.toContain("12345s");
  });

  it("mostra o tempo de toda resposta, inclusive as antigas já normalizadas", () => {
    const prompt = buildStudentAnalysisPrompt(input());

    expect(prompt).toContain("[ACERTOU] (?, 8.0s) Ache a rima");
  });

  it("mostra n/d quando a sessão não tem média em milissegundos", () => {
    const data = input();
    data.sessions[0].averageTimeToAnswer = undefined;

    expect(buildStudentAnalysisPrompt(data)).toContain("tempo médio por questão: n/d");
  });
});
