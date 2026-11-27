// BE-EQ-05: depois de compartilhar, o colega lê o paciente e cria evolução;
// depois de desfazer, recebe 403. Use cases reais de ponta a ponta, com
// repositórios em memória.
import { describe, expect, it, vi } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { CriterionResult, SessionEvolution } from "../../../../../domain/entities/session-evolution";
import { TaskNotebookSession } from "../../../../../domain/entities/task-notebook-session";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { CreateSessionEvolutionUseCase } from "../../../session-evolution/use-cases/create-session-evolution/create-session-evolution-use-case";
import { GetSessionEvolutionUseCase } from "../../../session-evolution/use-cases/get-session-evolution/get-session-evolution-use-case";
import { ListStudentsByEducatorUseCase } from "../list-students-by-educator/list-students-by-educator-use-case";
import { UnshareStudentUseCase } from "../unshare-student/unshare-student-use-case";
import { setupSharing } from "../test-fixtures";
import { ShareStudentUseCase } from "./share-student-use-case";

const setup = () => {
  const ctx = setupSharing();
  const finishedAt = new Date("2026-11-20T14:00:00.000Z");
  // Sessão conduzida pela colega no paciente da dona.
  const session = new TaskNotebookSession(
    Uuid.random(),
    ctx.student.id,
    ctx.colleague.id,
    "Sessão de leitura",
    new Date(finishedAt.getTime() - 40 * 60000),
    finishedAt
  );

  const evolutions = new Map<string, SessionEvolution>();
  const sessionRepository = {
    getById: vi.fn(async (id: Uuid) => (id.value === session.id.value ? session : null)),
    save: vi.fn(async () => undefined),
  } as unknown as TaskNotebookSessionRepository;
  const evolutionRepository = {
    findById: vi.fn(async (id: Uuid) => evolutions.get(id.value) ?? null),
    findBySessionId: vi.fn(
      async (sessionId: Uuid) =>
        [...evolutions.values()].find((e) => e.sessionId.value === sessionId.value) ?? null
    ),
    save: vi.fn(async (evolution: SessionEvolution) => {
      evolutions.set(evolution.id.value, evolution);
    }),
  } as unknown as SessionEvolutionRepository;
  const planRepository = { findById: vi.fn(async () => null) } as unknown as PlanRepository;

  const deps = [ctx.studentAccess, ctx.shareRepository, ctx.memberRepository, ctx.educatorRepository] as const;
  return {
    ...ctx,
    session,
    share: new ShareStudentUseCase(...deps),
    unshare: new UnshareStudentUseCase(...deps),
    listStudents: new ListStudentsByEducatorUseCase(ctx.studentAccess, ctx.educatorRepository),
    createEvolution: new CreateSessionEvolutionUseCase(
      sessionRepository,
      ctx.studentAccess,
      planRepository,
      evolutionRepository
    ),
    getEvolution: new GetSessionEvolutionUseCase(
      evolutionRepository,
      ctx.studentAccess,
      ctx.educatorRepository
    ),
  };
};

const evolutionInput = (educatorId: Uuid, sessionId: string) => ({
  educatorId,
  sessionId,
  criteria: [
    { description: "Leu sílabas", attempts: 10, successes: 8, result: CriterionResult.PARTIAL },
  ],
  descriptiveRecord: "Registro da sessão",
});

describe("Paciente compartilhado (BE-EQ-05)", () => {
  it("sem compartilhamento a colega recebe 403", async () => {
    const { colleague, session, createEvolution } = setup();

    const result = await createEvolution.execute(evolutionInput(colleague.id, session.id.value));

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
  });

  it("depois de compartilhar a colega lê e cria evolução; depois de desfazer recebe 403", async () => {
    const { owner, colleague, student, session, share, unshare, listStudents, createEvolution, getEvolution } =
      setup();

    const shared = await share.execute({
      educatorId: owner.id,
      studentId: student.id.value,
      targetEducatorId: colleague.id.value,
    });
    expect(shared.ok).toBe(true);

    // Lê: o paciente aparece na lista dela como SHARED.
    const list = await listStudents.execute({ educatorId: colleague.id });
    expect(list).toEqual([
      expect.objectContaining({ id: student.id.value, access: "SHARED", ownerName: "Paula" }),
    ]);

    // Cria a evolução, gravada com ela como autora (EQ-12).
    const created = await createEvolution.execute(evolutionInput(colleague.id, session.id.value));
    expect(created.ok).toBe(true);
    const evolution = (created as any).value as SessionEvolution;
    expect(evolution.educatorId.value).toBe(colleague.id.value);

    // A dona lê a evolução com o nome da autora.
    const byOwner = await getEvolution.execute({
      educatorId: owner.id,
      evolutionId: evolution.id.value,
    });
    expect(byOwner).toEqual({ ok: true, value: { evolution, authorName: "Carla" } });

    const unshared = await unshare.execute({
      educatorId: owner.id,
      studentId: student.id.value,
      targetEducatorId: colleague.id.value,
    });
    expect(unshared).toEqual({ ok: true, value: [] });

    expect(
      await getEvolution.execute({ educatorId: colleague.id, evolutionId: evolution.id.value })
    ).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(await listStudents.execute({ educatorId: colleague.id })).toEqual([]);
  });
});
