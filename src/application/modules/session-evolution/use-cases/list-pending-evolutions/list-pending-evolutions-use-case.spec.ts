import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { ListPendingEvolutionsUseCase } from "./list-pending-evolutions-use-case";
import { CreateSessionEvolutionUseCase } from "../create-session-evolution/create-session-evolution-use-case";
import { SessionEvolution } from "../../../../../domain/entities/session-evolution";
import { TaskNotebookSession } from "../../../../../domain/entities/task-notebook-session";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { makeSession, makeStudent } from "../test-fixtures";

describe("ListPendingEvolutionsUseCase", () => {
  const educatorId = Uuid.random();
  const ana = makeStudent(educatorId, "Ana");
  const bruno = makeStudent(educatorId, "Bruno");
  const moved = makeStudent(Uuid.random(), "Carla");
  const appointmentId = Uuid.random();

  let older: TaskNotebookSession;
  let recent: TaskNotebookSession;
  let fromMovedStudent: TaskNotebookSession;
  let evolutions: SessionEvolution[];
  let sessionRepository: TaskNotebookSessionRepository;
  let evolutionRepository: SessionEvolutionRepository;
  let studentRepository: StudentRepository;
  let useCase: ListPendingEvolutionsUseCase;

  beforeEach(() => {
    older = makeSession({
      studentId: ana.id,
      educatorId,
      name: "Sessão antiga",
      startedAt: new Date("2026-11-05T13:00:00.000Z"),
    });
    recent = makeSession({
      studentId: bruno.id,
      educatorId,
      name: "Sessão recente",
      appointmentId,
      startedAt: new Date("2026-11-10T13:00:00.000Z"),
    });
    fromMovedStudent = makeSession({ studentId: moved.id, educatorId });

    // Repositório de evolução em memória: o pending enxerga o que o create grava.
    evolutions = [];
    evolutionRepository = {
      findBySessionId: vi.fn(async (sessionId: Uuid) =>
        evolutions.find((e) => e.sessionId.value === sessionId.value) ?? null
      ),
      save: vi.fn(async (evolution: SessionEvolution) => {
        evolutions.push(evolution);
      }),
      findIdsBySessionIds: vi.fn(async (sessionIds: Uuid[]) => {
        const wanted = new Set(sessionIds.map((id) => id.value));
        return new Map(
          evolutions
            .filter((e) => wanted.has(e.sessionId.value))
            .map((e) => [e.sessionId.value, e.id.value])
        );
      }),
    } as unknown as SessionEvolutionRepository;

    sessionRepository = {
      listFinishedByEducatorSince: vi.fn().mockResolvedValue([older, fromMovedStudent, recent]),
      getById: vi.fn(async (id: Uuid) =>
        [older, recent, fromMovedStudent].find((s) => s.id.value === id.value) ?? null
      ),
      save: vi.fn().mockResolvedValue(undefined),
    } as unknown as TaskNotebookSessionRepository;

    studentRepository = {
      getById: vi.fn(async (id: Uuid) =>
        [ana, bruno, moved].find((s) => s.id.value === id.value) ?? null
      ),
      getByIds: vi.fn().mockResolvedValue([ana, bruno, moved]),
    } as unknown as StudentRepository;

    useCase = new ListPendingEvolutionsUseCase(
      sessionRepository,
      evolutionRepository,
      studentRepository
    );
  });

  it("should search the sessions finished in the last `days` days", async () => {
    const before = Date.now();
    await useCase.execute({ educatorId, days: 30 });
    const after = Date.now();

    const params = (sessionRepository.listFinishedByEducatorSince as any).mock.calls[0][0];
    expect(params.educatorId).toBe(educatorId);
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    expect(params.since.getTime()).toBeGreaterThanOrEqual(before - thirtyDays);
    expect(params.since.getTime()).toBeLessThanOrEqual(after - thirtyDays);
  });

  it("should list sessions without evolution, most recently finished first", async () => {
    const result = await useCase.execute({ educatorId, days: 30 });

    expect(result).toEqual({
      ok: true,
      value: [
        {
          sessionId: recent.id.value,
          studentId: bruno.id.value,
          studentName: "Bruno",
          sessionName: "Sessão recente",
          finishedAt: recent.finishedAt,
          appointmentId: appointmentId.value,
        },
        {
          sessionId: older.id.value,
          studentId: ana.id.value,
          studentName: "Ana",
          sessionName: "Sessão antiga",
          finishedAt: older.finishedAt,
          appointmentId: undefined,
        },
      ],
    });
  });

  it("should drop the session once its evolution is created", async () => {
    const create = new CreateSessionEvolutionUseCase(
      sessionRepository,
      studentRepository,
      { findById: vi.fn(), save: vi.fn() } as unknown as PlanRepository,
      evolutionRepository
    );

    const before = ((await useCase.execute({ educatorId, days: 30 })) as any).value;
    expect(before.map((p: any) => p.sessionId)).toContain(recent.id.value);

    const created = await create.execute({
      educatorId,
      sessionId: recent.id.value,
      criteria: [],
      descriptiveRecord: "Registro",
    });
    expect(created.ok).toBe(true);

    const after = ((await useCase.execute({ educatorId, days: 30 })) as any).value;
    expect(after.map((p: any) => p.sessionId)).toEqual([older.id.value]);
  });

  it("should return an empty list without querying evolutions when there are no sessions", async () => {
    (sessionRepository.listFinishedByEducatorSince as any).mockResolvedValue([]);

    const result = await useCase.execute({ educatorId, days: 7 });

    expect(result).toEqual({ ok: true, value: [] });
    expect(evolutionRepository.findIdsBySessionIds).not.toHaveBeenCalled();
  });
});
