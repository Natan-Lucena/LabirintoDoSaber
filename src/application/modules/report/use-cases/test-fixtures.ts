// Repositórios simulados e entidades reais para os specs de relatório.
import { vi } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { Gender, Student } from "../../../../domain/entities/student";
import {
  Report,
  ReportAudience,
  ReportSection,
  ReportShare,
  ReportType,
} from "../../../../domain/entities/report";
import {
  ApplicationStatus,
  ScaleApplication,
} from "../../../../domain/entities/scale-application";
import { ScaleTemplate } from "../../../../domain/entities/scale-template";
import {
  CriterionResult,
  SessionEvolution,
} from "../../../../domain/entities/session-evolution";
import { Plan } from "../../../../domain/entities/plan";
import { AnamneseResponse } from "../../../../domain/entities/anamnese-response";
import { Task, TaskCategory, TaskType } from "../../../../domain/entities/task";
import { TaskNotebookSession } from "../../../../domain/entities/task-notebook-session";
import { ReportRepository } from "../../../../domain/repositories/report-repository";
import { SessionEvolutionRepository } from "../../../../domain/repositories/session-evolution-repository";
import { PlanRepository } from "../../../../domain/repositories/plan-repository";
import { ScaleApplicationRepository } from "../../../../domain/repositories/scale-application-repository";
import { AnamneseResponseRepository } from "../../../../domain/repositories/anamnese-response-repository";
import { TaskRepository } from "../../../../domain/repositories/task-repository";
import { TaskNotebookSessionRepository } from "../../../../domain/repositories/task-notebook-session-repository";
import { demoAnswers } from "../../../../domain/tests/entities/scale-fixtures";
import { dateInSaoPaulo } from "../../../../domain/utils/date-only";
import { makeAnswer, makeSession } from "../../session-evolution/use-cases/test-fixtures";

export { makeStudent, makePdi, makeSession } from "../../session-evolution/use-cases/test-fixtures";
export { makeDemoTemplate, demoAnswers } from "../../../../domain/tests/entities/scale-fixtures";
export { makeStudentRepository } from "../../scale-application/use-cases/test-fixtures";

export const unwrap = <T>(result: { ok: boolean; value?: T; error?: unknown }): T => {
  if (!result.ok) throw new Error(`unexpected ${JSON.stringify(result.error)}`);
  return result.value as T;
};

export const PERIOD = { from: "2026-11-01", to: "2026-11-30" };

export const PROFESSIONAL = { name: "Marina Fixture Souza", profession: "Psicopedagoga" };

// Aluno com todos os dados que nunca podem entrar no relatório (RP-01).
export const SENSITIVE = {
  name: "Joaozinho Fixture Pereira",
  phone: "11987654321",
  zipcode: "01310100",
  road: "Avenida Paulista Fixture",
  housenumber: "1578",
  photoUrl: "https://bucket/foto-fixture.png",
  documentUrl: "https://bucket/laudo-fixture.pdf",
  documentName: "laudo-fixture.pdf",
  guardianName: "Mariana Responsavel Fixture",
  guardianPhone: "11911112222",
  guardianRelationship: "Mae-fixture",
};

export const makeSensitiveStudent = (educatorId: Uuid) =>
  Student.create({
    name: SENSITIVE.name,
    age: 7,
    gender: Gender.Male,
    zipcode: SENSITIVE.zipcode,
    road: SENSITIVE.road,
    housenumber: SENSITIVE.housenumber,
    phonenumber: SENSITIVE.phone,
    learningTopics: ["leitura"],
    educators: [],
    educatorId,
    photoUrl: SENSITIVE.photoUrl,
    documents: [
      {
        id: "doc-1",
        name: SENSITIVE.documentName,
        url: SENSITIVE.documentUrl,
        uploadedAt: new Date(),
      },
    ],
    guardianName: SENSITIVE.guardianName,
    guardianPhone: SENSITIVE.guardianPhone,
    guardianRelationship: SENSITIVE.guardianRelationship,
  });

export const makeTask = (category: TaskCategory) =>
  unwrap<Task>(
    Task.create({
      category,
      type: TaskType.MultipleChoice,
      prompt: "Qual palavra rima com gato?",
      alternatives: [
        { text: "Pato", isCorrect: true },
        { text: "Casa", isCorrect: false },
      ],
    }) as { ok: boolean; value?: Task }
  );

// Sessão finalizada com respostas a uma task (acerto por posição).
export const makeAnsweredSession = (
  student: Student,
  startedAt: Date,
  task: Task,
  results: boolean[],
  finished = true
) =>
  makeSession({
    studentId: student.id,
    educatorId: student.educatorId,
    startedAt,
    finishedAt: finished ? undefined : null,
    answers: results.map((isCorrect) => ({ ...makeAnswer(isCorrect), taskId: task.id })),
  });

export const makeEvolution = (
  session: TaskNotebookSession,
  record: string,
  plan?: Plan
) =>
  unwrap<SessionEvolution>(
    SessionEvolution.create({
      session,
      educatorId: session.educatorId,
      plan,
      criteria: [
        { description: "Ler sílabas", result: CriterionResult.ACHIEVED },
        { description: "Ler palavras", result: CriterionResult.PARTIAL },
      ],
      descriptiveRecord: record,
    })
  );

export const makeCompletedApplication = (
  template: ScaleTemplate,
  student: Student,
  completedAt: Date,
  values = [1, 1, 1, 1, 0, 0, 0, 0]
) =>
  ScaleApplication.fromPersistence({
    id: Uuid.random(),
    templateId: template.id,
    templateCode: template.code,
    templateVersion: template.version,
    templateName: template.name,
    studentId: student.id,
    educatorId: student.educatorId,
    status: ApplicationStatus.COMPLETED,
    answers: demoAnswers(values),
    startedAt: completedAt,
    updatedAt: completedAt,
    completedAt,
  });

export const makeAnamneseWithSummary = (
  student: Student,
  text: string,
  generatedAt: Date
) =>
  AnamneseResponse.fromPersistence({
    id: Uuid.random(),
    templateId: Uuid.random(),
    educatorId: student.educatorId,
    studentId: student.id,
    answers: [],
    answeredAt: generatedAt,
    summary: { text, generatedAt },
  });

export const makeReport = (
  student: Student,
  overrides: Partial<{ type: ReportType; audience: ReportAudience; sections: ReportSection[] }> = {}
) =>
  unwrap<Report>(
    Report.create({
      studentId: student.id,
      studentName: student.name,
      educatorId: student.educatorId,
      type: overrides.type ?? ReportType.PROGRESS,
      audience: overrides.audience ?? ReportAudience.FAMILY,
      periodFrom: PERIOD.from,
      periodTo: PERIOD.to,
      sections: overrides.sections ?? [ReportSection.PATIENT_DATA, ReportSection.EVOLUTIONS],
      content: {
        title: "Relatório de progresso",
        generatedAt: new Date().toISOString(),
        professional: { name: PROFESSIONAL.name },
      },
      synthesisFailed: false,
    })
  );

// "Banco" em memória atrás de vi.fn(), para encadear use cases num mesmo spec.
export const makeReportRepository = (initial: Report[] = []) => {
  const store = new Map(initial.map((report) => [report.id.value, report]));
  return {
    store,
    save: vi.fn(async (report: Report) => {
      store.set(report.id.value, report);
    }),
    findById: vi.fn(async (id: Uuid) => store.get(id.value) ?? null),
    addShare: vi.fn(async (id: Uuid, share: ReportShare) => {
      const report = store.get(id.value);
      if (report) store.set(id.value, report.share(share.channel, share.at));
    }),
    search: vi.fn(async ({ studentIds, limit }: { studentIds: Uuid[]; limit: number }) =>
      [...store.values()]
        .filter((report) => studentIds.some((id) => id.value === report.studentId.value))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
        .slice(0, limit)
    ),
    delete: vi.fn(async (id: Uuid) => {
      store.delete(id.value);
    }),
  } satisfies ReportRepository & { store: Map<string, Report> };
};

export const makeSessionRepository = (sessions: TaskNotebookSession[]) =>
  ({
    save: vi.fn(),
    getById: vi.fn(),
    listByStudentId: vi.fn(async (studentId: Uuid) =>
      sessions.filter((session) => session.studentId.value === studentId.value)
    ),
    listByEducatorId: vi.fn(),
    listFinishedByEducatorSince: vi.fn(),
    listFinishedBetween: vi.fn(),
  }) satisfies TaskNotebookSessionRepository;

export const makeTaskRepository = (tasks: Task[]) =>
  ({
    save: vi.fn(),
    saveMany: vi.fn(),
    getById: vi.fn(),
    getByIds: vi.fn(async (ids: Uuid[]) =>
      tasks.filter((task) => ids.some((id) => id.value === task.id.value))
    ),
    search: vi.fn(),
    delete: vi.fn(),
  }) satisfies TaskRepository;

export const makeEvolutionRepository = (initial: SessionEvolution[]) => {
  const store = new Map(initial.map((evolution) => [evolution.id.value, evolution]));
  return {
    store,
    save: vi.fn(async (evolution: SessionEvolution) => {
      store.set(evolution.id.value, evolution);
    }),
    findById: vi.fn(async (id: Uuid) => store.get(id.value) ?? null),
    findBySessionId: vi.fn(),
    search: vi.fn(
      async (params: { studentIds: Uuid[]; from?: string; to?: string; limit: number }) =>
        [...store.values()]
          .filter((evolution) =>
            params.studentIds.some((id) => id.value === evolution.studentId.value)
          )
          .filter(
            (evolution) =>
              (!params.from || evolution.sessionDate >= params.from) &&
              (!params.to || evolution.sessionDate <= params.to)
          )
          .sort((a, b) => b.sessionDate.localeCompare(a.sessionDate))
          .slice(0, params.limit)
    ),
    findIdsBySessionIds: vi.fn(),
  } satisfies SessionEvolutionRepository & { store: Map<string, SessionEvolution> };
};

export const makePlanRepository = (plans: Plan[]) =>
  ({
    save: vi.fn(),
    findById: vi.fn(),
    search: vi.fn(async (params: { educatorId: Uuid; studentId?: Uuid }) =>
      plans.filter(
        (plan) =>
          plan.educatorId.value === params.educatorId.value &&
          (!params.studentId || plan.studentId.value === params.studentId.value)
      )
    ),
    findActivePdi: vi.fn(),
    listActiveWithReviewDueBy: vi.fn(),
  }) satisfies PlanRepository;

export const makeApplicationRepository = (applications: ScaleApplication[]) =>
  ({
    save: vi.fn(),
    findById: vi.fn(),
    findDraft: vi.fn(),
    search: vi.fn(
      async (params: {
        studentIds: Uuid[];
        status?: ApplicationStatus;
        completedFrom?: Date;
        completedTo?: Date;
        limit: number;
      }) =>
        applications
          .filter((application) =>
            params.studentIds.some((id) => id.value === application.studentId.value)
          )
          .filter((application) => !params.status || application.status === params.status)
          .filter(
            (application) =>
              (!params.completedFrom ||
                (application.completedAt && application.completedAt >= params.completedFrom)) &&
              (!params.completedTo ||
                (application.completedAt && application.completedAt <= params.completedTo))
          )
          .slice(0, params.limit)
    ),
    delete: vi.fn(),
    saveInsight: vi.fn(),
    listDraftsUpdatedBefore: vi.fn(),
  }) satisfies ScaleApplicationRepository;

export const makeAnamneseResponseRepository = (responses: AnamneseResponse[]) =>
  ({
    save: vi.fn(),
    findById: vi.fn(),
    listByStudentId: vi.fn(async (studentId: Uuid) =>
      responses.filter((response) => response.studentId.value === studentId.value)
    ),
    existsByTemplateId: vi.fn(),
    saveSummary: vi.fn(),
  }) satisfies AnamneseResponseRepository;

// Data (AAAA-MM-DD) de uma sessão, para conferir as evoluções no conteúdo.
export const sessionDateOf = (session: TaskNotebookSession) => dateInSaoPaulo(session.startedAt);
