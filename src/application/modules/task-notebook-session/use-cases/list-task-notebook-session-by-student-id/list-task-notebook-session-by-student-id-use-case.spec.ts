import { describe, it, expect, vi } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { ListTaskNotebookSessionByStudentIdUseCase } from "./list-task-notebook-session-by-student-id-use-case";
import { TaskNotebookSession } from "../../../../../domain/entities/task-notebook-session";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";

const makeSession = (studentId: Uuid) =>
  new TaskNotebookSession(
    Uuid.random(),
    studentId,
    Uuid.random(),
    "Sessão",
    new Date("2026-11-10T13:00:00.000Z"),
    new Date("2026-11-10T13:40:00.000Z")
  );

describe("ListTaskNotebookSessionByStudentIdUseCase", () => {
  it("should add evolutionId to the sessions that have an evolution, with one batch query", async () => {
    const studentId = Uuid.random();
    const withEvolution = makeSession(studentId);
    const withoutEvolution = makeSession(studentId);
    const evolutionId = Uuid.random().value;

    const sessionRepository = {
      listByStudentId: vi.fn().mockResolvedValue([withEvolution, withoutEvolution]),
    } as unknown as TaskNotebookSessionRepository;
    const evolutionRepository = {
      findIdsBySessionIds: vi
        .fn()
        .mockResolvedValue(new Map([[withEvolution.id.value, evolutionId]])),
    } as unknown as SessionEvolutionRepository;

    const useCase = new ListTaskNotebookSessionByStudentIdUseCase(
      sessionRepository,
      evolutionRepository
    );

    const result = await useCase.execute({ studentId: studentId.value });

    expect(evolutionRepository.findIdsBySessionIds).toHaveBeenCalledTimes(1);
    expect(evolutionRepository.findIdsBySessionIds).toHaveBeenCalledWith([
      withEvolution.id,
      withoutEvolution.id,
    ]);
    expect(result[0].id).toBe(withEvolution.id);
    expect(result[0].name).toBe("Sessão");
    expect(result[0].evolutionId).toBe(evolutionId);
    expect(result[1].evolutionId).toBeUndefined();
    expect(JSON.parse(JSON.stringify(result[1]))).not.toHaveProperty("evolutionId");
  });
});
