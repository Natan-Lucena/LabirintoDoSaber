import { describe, it, expect } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import {
  ActivityResult,
  summarizeActivityResults,
} from "../../entities/activity-result";
import { CreateTaskProps, Task, TaskCategory, TaskType } from "../../entities/task";

const makeTask = (props: Omit<CreateTaskProps, "category">) => {
  const created = Task.create({ category: TaskCategory.Reading, ...props });
  if (!created.ok) throw new Error(JSON.stringify(created.error));
  return created.value;
};

const makeWordBuilderTask = () =>
  makeTask({
    type: TaskType.WordBuilder,
    prompt: "Monte a palavra",
    content: { kind: "wordBuilder", word: "BOLA" },
  });

const makeMultipleChoiceTask = () =>
  makeTask({
    type: TaskType.MultipleChoice,
    prompt: "Qual rima com gato?",
    alternatives: [
      { text: "Pato", isCorrect: true },
      { text: "Casa", isCorrect: false },
    ],
  });

const makePrintableTask = () =>
  makeTask({
    type: TaskType.Printable,
    prompt: "Complete no papel",
    content: {
      kind: "printable",
      title: "Complete a sequência",
      instructions: "Escreva o número que falta",
      layout: "SEQUENCE",
      items: [{ id: "1", text: "1, 2, __" }],
    },
  });

const validInput = {
  completed: true,
  correct: true,
  attempts: 2,
  errors: 1,
  durationMs: 45000,
};

const create = (overrides: Partial<typeof validInput> = {}, task = makeWordBuilderTask()) =>
  ActivityResult.create({ sessionId: Uuid.random(), task, ...validInput, ...overrides });

const unwrap = (result: ReturnType<typeof ActivityResult.create>) => {
  if (!result.ok) throw new Error(String(result.error));
  return result.value;
};

describe("ActivityResult", () => {
  it("should record the result of a playable task with the task type", () => {
    const sessionId = Uuid.random();
    const task = makeWordBuilderTask();

    const result = unwrap(
      ActivityResult.create({ sessionId, task, ...validInput })
    );

    expect(result.id).toBeInstanceOf(Uuid);
    expect(result.sessionId.value).toBe(sessionId.value);
    expect(result.taskId.value).toBe(task.id.value);
    expect(result.taskType).toBe(TaskType.WordBuilder);
    expect(result.completed).toBe(true);
    expect(result.correct).toBe(true);
    expect(result.attempts).toBe(2);
    expect(result.errors).toBe(1);
    expect(result.durationMs).toBe(45000);
    expect(result.recordedAt).toBeInstanceOf(Date);
  });

  it("RS-03: should refuse multiple choice with USE_ANSWER_ROUTE", () => {
    expect(create({}, makeMultipleChoiceTask())).toEqual({
      ok: false,
      error: "USE_ANSWER_ROUTE",
    });
  });

  it("RS-03: should refuse a printable task with PRINTABLE_NOT_PLAYABLE", () => {
    expect(create({}, makePrintableTask())).toEqual({
      ok: false,
      error: "PRINTABLE_NOT_PLAYABLE",
    });
  });

  it("should accept the limits of attempts, errors and duration", () => {
    expect(create({ attempts: 1, errors: 0, durationMs: 0 }).ok).toBe(true);
    expect(create({ attempts: 50, errors: 50, durationMs: 3_600_000 }).ok).toBe(true);
  });

  it.each([
    { attempts: 0 },
    { attempts: 51 },
    { attempts: 1.5 },
    { errors: -1 },
    { errors: 51 },
    { durationMs: -1 },
    { durationMs: 3_600_001 },
  ])("should refuse out of range values %o", (overrides) => {
    expect(create(overrides)).toEqual({ ok: false, error: "INVALID_ACTIVITY_RESULT" });
  });

  it("RS-05: should summarize total, completed and correct", () => {
    const results = [
      unwrap(create({ completed: true, correct: true })),
      unwrap(create({ completed: true, correct: false })),
      unwrap(create({ completed: false, correct: false })),
    ];

    expect(summarizeActivityResults(results)).toEqual({
      total: 3,
      completed: 2,
      correct: 1,
    });
    expect(summarizeActivityResults([])).toEqual({ total: 0, completed: 0, correct: 0 });
  });
});
