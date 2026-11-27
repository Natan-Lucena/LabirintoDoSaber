import { describe, it, expect } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { TaskNotebookSession } from "../../domain/entities/task-notebook-session";
import { mapTaskNotebookSessionToResponse } from "./map-task-notebook-session";

const answer = (timeToAnswer: number, answeredAt: string) => ({
  taskId: Uuid.random(),
  selectedAlternativeId: Uuid.random(),
  isCorrect: true,
  timeToAnswer,
  answeredAt: new Date(answeredAt),
});

const session = new TaskNotebookSession(
  Uuid.random(),
  Uuid.random(),
  Uuid.random(),
  "Sessão",
  new Date("2026-10-08T12:00:00.000Z"),
  new Date("2026-10-09T13:00:00.000Z"),
  [
    // Antes do corte, em segundos.
    answer(12, "2026-10-08T12:00:10.000Z"),
    // Depois do corte, em milissegundos.
    answer(3000, "2026-10-09T12:00:00.000Z"),
  ]
);

describe("mapTaskNotebookSessionToResponse (PP-08)", () => {
  it("should add timeToAnswerMs to each answer and keep the raw timeToAnswer", () => {
    const json = JSON.parse(JSON.stringify(mapTaskNotebookSessionToResponse(session)));

    expect(json.answers.map((a: any) => [a.timeToAnswer, a.timeToAnswerMs])).toEqual([
      [12, 12000],
      [3000, 3000],
    ]);
  });

  it("should keep the previous JSON shape of the session", () => {
    const json = JSON.parse(JSON.stringify(mapTaskNotebookSessionToResponse(session)));
    const previous = JSON.parse(JSON.stringify(session));

    expect({
      ...json,
      answers: json.answers.map(({ timeToAnswerMs: _, ...rest }: any) => rest),
    }).toEqual(previous);
  });
});
