import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { Appointment, AppointmentStatus } from "../../../../../domain/entities/appointment";
import { Plan, PlanSource, PlanStatus, PlanType } from "../../../../../domain/entities/plan";
import {
  ApplicationStatus,
  ScaleApplication,
} from "../../../../../domain/entities/scale-application";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import {
  ScaleApplicationRepository,
  SearchScaleApplicationParams,
} from "../../../../../domain/repositories/scale-application-repository";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import {
  FinishedSessionRef,
  ListFinishedBetweenParams,
  TaskNotebookSessionRepository,
} from "../../../../../domain/repositories/task-notebook-session-repository";
import { shareStudent } from "../../../../../domain/tests/fakes/student-share-fakes";
import { makeStudent, setupSharing } from "../test-fixtures";
import { GetStudentsOverviewUseCase } from "./get-students-overview-use-case";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
// 12:00 em São Paulo.
const NOW = new Date("2026-11-26T15:00:00.000Z");

const ids = (list: Uuid[] | undefined) => (list ?? []).map((id) => id.value).sort();

const setup = () => {
  const ctx = setupSharing();
  const appointments: Appointment[] = [];
  const sessions: FinishedSessionRef[] = [];
  const evolutionSessionIds = new Set<string>();
  const plans: Plan[] = [];
  const applications: ScaleApplication[] = [];
  const anamnesisStudentIds = new Set<string>();

  const inIds = (list: Uuid[] | undefined, id: Uuid) =>
    !list || list.some((item) => item.value === id.value);

  // Os repositórios em memória aplicam os mesmos filtros das consultas reais.
  // Mesma semântica das consultas reais: o próximo PENDING de cada aluno.
  const appointmentRepository = {
    findNextPendingByStudentIds: vi.fn(async (studentIds: Uuid[], after: Date) => {
      const next = new Map<string, Appointment>();
      for (const a of appointments) {
        if (!inIds(studentIds, a.studentId)) continue;
        if (a.status !== AppointmentStatus.PENDING || a.scheduledAt <= after) continue;
        const current = next.get(a.studentId.value);
        if (!current || a.scheduledAt < current.scheduledAt) next.set(a.studentId.value, a);
      }
      return [...next.values()];
    }),
  } as unknown as AppointmentRepository;

  const sessionRepository = {
    listFinishedBetween: vi.fn(async (params: ListFinishedBetweenParams) =>
      sessions.filter(
        (s) =>
          inIds(params.studentIds, s.studentId) &&
          s.finishedAt >= params.from &&
          s.finishedAt <= params.to
      )
    ),
  } as unknown as TaskNotebookSessionRepository;

  const evolutionRepository = {
    findIdsBySessionIds: vi.fn(async (sessionIds: Uuid[]) =>
      new Map(
        sessionIds
          .filter((id) => evolutionSessionIds.has(id.value))
          .map((id) => [id.value, Uuid.random().value])
      )
    ),
  } as unknown as SessionEvolutionRepository;

  // PDIs ACTIVE, ACTIVE com revisão até reviewDueBy e o PE ACTIVE mais
  // recente de cada aluno.
  const planRepository = {
    listForOverview: vi.fn(async (studentIds: Uuid[], reviewDueBy: string) => {
      const active = plans.filter(
        (p) => inIds(studentIds, p.studentId) && p.status === PlanStatus.ACTIVE
      );
      const latestPe = new Map<string, Plan>();
      for (const p of active.filter((p) => p.type === PlanType.PE)) {
        const current = latestPe.get(p.studentId.value);
        if (!current || (p.sessionDate ?? "") > (current.sessionDate ?? "")) {
          latestPe.set(p.studentId.value, p);
        }
      }
      const latestIds = new Set([...latestPe.values()].map((p) => p.id.value));
      return active.filter(
        (p) =>
          p.type === PlanType.PDI ||
          (p.nextReviewDate !== undefined && p.nextReviewDate <= reviewDueBy) ||
          latestIds.has(p.id.value)
      );
    }),
  } as unknown as PlanRepository;

  const scaleApplicationRepository = {
    search: vi.fn(async (params: SearchScaleApplicationParams) =>
      applications
        .filter(
          (a) =>
            inIds(params.studentIds, a.studentId) && (!params.status || a.status === params.status)
        )
        .slice(0, params.limit)
    ),
  } as unknown as ScaleApplicationRepository;

  const anamneseResponseRepository = {
    findStudentIdsWithResponses: vi.fn(
      async (studentIds: Uuid[]) =>
        new Set(studentIds.map((id) => id.value).filter((id) => anamnesisStudentIds.has(id)))
    ),
  } as unknown as AnamneseResponseRepository;

  const useCase = new GetStudentsOverviewUseCase(
    ctx.studentAccess,
    appointmentRepository,
    sessionRepository,
    evolutionRepository,
    planRepository,
    scaleApplicationRepository,
    anamneseResponseRepository
  );

  // Por padrão o aluno do setup já tem anamnese.
  anamnesisStudentIds.add(ctx.student.id.value);

  const finishedSession = (studentId: Uuid, finishedAt: Date, educatorId = ctx.owner.id) => {
    const session = { id: Uuid.random(), studentId, educatorId, finishedAt };
    sessions.push(session);
    return session;
  };

  return {
    ...ctx,
    useCase,
    appointments,
    plans,
    applications,
    evolutionSessionIds,
    anamnesisStudentIds,
    finishedSession,
    appointmentRepository,
    sessionRepository,
    evolutionRepository,
    planRepository,
    scaleApplicationRepository,
    anamneseResponseRepository,
  };
};

const pdi = (studentId: Uuid, educatorId: Uuid, nextReviewDate?: string) => {
  const created = Plan.create({
    educatorId,
    studentId,
    type: PlanType.PDI,
    source: PlanSource.MANUAL,
    title: "PDI",
    generalObjective: "Objetivo",
    startDate: "2026-10-01",
    endDate: "2027-03-01",
    nextReviewDate,
    goals: [{ description: "Meta" }],
  });
  if (!created.ok) throw new Error(String(created.error));
  return created.value;
};

describe("GetStudentsOverviewUseCase", () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sessão finalizada agora sem evolução aparece como EVOLUTION_PENDING na hora (BE-PA-03)", async () => {
    const { owner, student, useCase, finishedSession } = setup();
    const session = finishedSession(student.id, new Date(NOW.getTime() - MINUTE));

    const result = await useCase.execute({ educatorId: owner.id, status: "ACTIVE" });

    expect(result).toEqual([
      {
        studentId: student.id.value,
        primaryStatus: "NO_PLAN",
        pendings: [{ kind: "EVOLUTION_PENDING", count: 1, targetId: session.id.value }],
      },
    ]);
  });

  it("EVOLUTION_PENDING: sessão com evolução ou fora da janela de 30 dias não conta", async () => {
    const { owner, student, useCase, finishedSession, evolutionSessionIds } = setup();
    const withEvolution = finishedSession(student.id, new Date(NOW.getTime() - DAY));
    evolutionSessionIds.add(withEvolution.id.value);
    finishedSession(student.id, new Date(NOW.getTime() - 31 * DAY));
    const pending = finishedSession(student.id, new Date(NOW.getTime() - 29 * DAY));

    const [overview] = await useCase.execute({ educatorId: owner.id, status: "ACTIVE" });

    expect(overview.pendings).toEqual([
      { kind: "EVOLUTION_PENDING", count: 1, targetId: pending.id.value },
    ]);
  });

  it("monta status, plano, próximo atendimento e pendências do aluno", async () => {
    const { owner, colleague, student, useCase, plans, appointments, applications } = setup();
    const plan = pdi(student.id, owner.id, "2026-11-28");
    plans.push(plan);
    const next = Appointment.create({
      educatorId: colleague.id,
      studentId: student.id,
      scheduledAt: new Date("2026-11-27T13:00:00.000Z"),
    });
    appointments.push(
      next,
      Appointment.create({
        educatorId: owner.id,
        studentId: student.id,
        scheduledAt: new Date("2026-11-20T13:00:00.000Z"),
      }),
      Appointment.create({
        educatorId: owner.id,
        studentId: student.id,
        scheduledAt: new Date("2026-11-26T18:00:00.000Z"),
        status: AppointmentStatus.CANCELLED,
      })
    );
    const draft = ScaleApplication.fromPersistence({
      id: Uuid.random(),
      templateId: Uuid.random(),
      templateCode: "SNAP-IV",
      templateVersion: 1,
      templateName: "SNAP-IV",
      studentId: student.id,
      educatorId: owner.id,
      status: ApplicationStatus.DRAFT,
      answers: [],
      startedAt: NOW,
      updatedAt: NOW,
    });
    applications.push(draft);

    const [overview] = await useCase.execute({ educatorId: owner.id, status: "ACTIVE" });

    expect(overview).toEqual({
      studentId: student.id.value,
      primaryStatus: "ASSESSMENT_PENDING",
      activePlan: { id: plan.id.value, type: "PDI", title: "PDI", percent: 0 },
      nextAppointment: { id: next.id.value, scheduledAt: "2026-11-27T13:00:00.000Z" },
      pendings: [
        { kind: "PLAN_REVIEW_DUE", count: 1, targetId: plan.id.value },
        { kind: "SCALE_DRAFT", count: 1, targetId: draft.id.value },
      ],
    });
  });

  it("aluno sem anamnese: ANAMNESIS_MISSING e ASSESSMENT_PENDING", async () => {
    const { owner, useCase, anamnesisStudentIds } = setup();
    anamnesisStudentIds.clear();

    const [overview] = await useCase.execute({ educatorId: owner.id, status: "ACTIVE" });

    expect(overview.primaryStatus).toBe("ASSESSMENT_PENDING");
    expect(overview.pendings).toEqual([{ kind: "ANAMNESIS_MISSING", count: 1 }]);
  });

  it("alunos acessíveis (dono e compartilhado), sem os de outros educadores", async () => {
    const { owner, colleague, outsider, student, shareRepository, studentRepository, useCase } = setup();
    const own = makeStudent(colleague.id, "Bruno");
    const other = makeStudent(outsider.id, "Caio");
    studentRepository.store.set(own.id.value, own);
    studentRepository.store.set(other.id.value, other);
    shareRepository.store.push(shareStudent(student, colleague.id));

    const result = await useCase.execute({ educatorId: colleague.id, status: "ACTIVE" });

    expect(result.map((item) => item.studentId).sort()).toEqual(
      [own.id.value, student.id.value].sort()
    );
    expect(owner).toBeDefined();
  });

  it("status: padrão ACTIVE sem os arquivados; ARCHIVED só eles; ALL todos", async () => {
    const { owner, student, studentRepository, useCase } = setup();
    const archived = makeStudent(owner.id, "Bruno");
    archived.archive(NOW);
    studentRepository.store.set(archived.id.value, archived);

    const active = await useCase.execute({ educatorId: owner.id, status: "ACTIVE" });
    const onlyArchived = await useCase.execute({ educatorId: owner.id, status: "ARCHIVED" });
    const all = await useCase.execute({ educatorId: owner.id, status: "ALL" });

    expect(active.map((item) => item.studentId)).toEqual([student.id.value]);
    expect(onlyArchived.map((item) => item.studentId)).toEqual([archived.id.value]);
    expect(all).toHaveLength(2);
  });

  it("consulta em lote: uma chamada por repositório para todos os alunos (sem N+1)", async () => {
    const ctx = setup();
    const { owner, student, studentRepository, useCase, finishedSession } = ctx;
    const second = makeStudent(owner.id, "Bruno");
    const third = makeStudent(owner.id, "Caio");
    studentRepository.store.set(second.id.value, second);
    studentRepository.store.set(third.id.value, third);
    finishedSession(student.id, new Date(NOW.getTime() - DAY));
    finishedSession(third.id, new Date(NOW.getTime() - DAY));

    const result = await useCase.execute({ educatorId: owner.id, status: "ACTIVE" });

    expect(result).toHaveLength(3);
    const allIds = [student.id.value, second.id.value, third.id.value].sort();

    expect(ctx.appointmentRepository.findNextPendingByStudentIds).toHaveBeenCalledOnce();
    const [appointmentIds, after] = vi.mocked(ctx.appointmentRepository.findNextPendingByStudentIds)
      .mock.calls[0];
    expect(ids(appointmentIds)).toEqual(allIds);
    expect(after).toEqual(NOW);

    expect(ctx.sessionRepository.listFinishedBetween).toHaveBeenCalledOnce();
    const sessionParams = vi.mocked(ctx.sessionRepository.listFinishedBetween).mock.calls[0][0];
    expect(ids(sessionParams.studentIds)).toEqual(allIds);
    expect(sessionParams.from).toEqual(new Date(NOW.getTime() - 30 * DAY));
    expect(sessionParams.to).toEqual(NOW);

    expect(ctx.evolutionRepository.findIdsBySessionIds).toHaveBeenCalledOnce();

    expect(ctx.planRepository.listForOverview).toHaveBeenCalledOnce();
    const [planIds, reviewDueBy] = vi.mocked(ctx.planRepository.listForOverview).mock.calls[0];
    expect(ids(planIds)).toEqual(allIds);
    // Hoje (2026-11-26 em São Paulo) + 2 dias.
    expect(reviewDueBy).toBe("2026-11-28");

    expect(ctx.scaleApplicationRepository.search).toHaveBeenCalledOnce();
    const scaleParams = vi.mocked(ctx.scaleApplicationRepository.search).mock.calls[0][0];
    expect(ids(scaleParams.studentIds)).toEqual(allIds);
    expect(scaleParams.status).toBe(ApplicationStatus.DRAFT);

    expect(ctx.anamneseResponseRepository.findStudentIdsWithResponses).toHaveBeenCalledOnce();
    const anamnesisIds = vi.mocked(ctx.anamneseResponseRepository.findStudentIdsWithResponses).mock
      .calls[0][0];
    expect(ids(anamnesisIds)).toEqual(allIds);
  });

  it("sem alunos: lista vazia sem consultar os demais repositórios", async () => {
    const { outsider, useCase, planRepository, appointmentRepository } = setup();

    expect(await useCase.execute({ educatorId: outsider.id, status: "ACTIVE" })).toEqual([]);
    expect(planRepository.listForOverview).not.toHaveBeenCalled();
    expect(appointmentRepository.findNextPendingByStudentIds).not.toHaveBeenCalled();
  });

  it("sem sessão finalizada: não consulta evoluções", async () => {
    const { owner, useCase, evolutionRepository } = setup();

    await useCase.execute({ educatorId: owner.id, status: "ACTIVE" });

    expect(evolutionRepository.findIdsBySessionIds).not.toHaveBeenCalled();
  });

  it("sem PDI, o plano ativo é o PE mais recente entre os vários do aluno", async () => {
    const { owner, student, useCase, plans } = setup();
    const pe = (sessionDate: string, title: string) => {
      const created = Plan.create({
        educatorId: owner.id,
        studentId: student.id,
        type: PlanType.PE,
        source: PlanSource.MANUAL,
        title,
        generalObjective: "Sessão",
        sessionDate,
        goals: [{ description: "Meta" }],
      });
      if (!created.ok) throw new Error(String(created.error));
      return created.value;
    };
    plans.push(pe("2026-11-01", "Antigo"), pe("2026-11-20", "Recente"), pe("2026-11-10", "Meio"));

    const [overview] = await useCase.execute({ educatorId: owner.id, status: "ACTIVE" });

    expect(overview.activePlan).toMatchObject({ type: "PE", title: "Recente" });
  });
});
