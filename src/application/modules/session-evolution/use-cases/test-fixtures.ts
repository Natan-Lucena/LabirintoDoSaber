// Fábricas de entidades reais para os specs do módulo de evolução.
import { expect } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { Gender, Student } from "../../../../domain/entities/student";
import { Plan, PlanSource, PlanStatus, PlanType } from "../../../../domain/entities/plan";
import {
  TaskAnswer,
  TaskNotebookSession,
} from "../../../../domain/entities/task-notebook-session";

export const makeStudent = (educatorId: Uuid, name = "Ana") =>
  Student.create({
    name,
    age: 8,
    gender: Gender.Female,
    zipcode: "00000000",
    road: "Rua",
    housenumber: "1",
    phonenumber: "11999999999",
    learningTopics: [],
    educators: [],
    educatorId,
  });

export const makeAnswer = (isCorrect: boolean): TaskAnswer => ({
  taskId: Uuid.random(),
  selectedAlternativeId: Uuid.random(),
  isCorrect,
  timeToAnswer: 10,
  answeredAt: new Date(),
});

interface SessionOptions {
  studentId: Uuid;
  educatorId: Uuid;
  startedAt?: Date;
  finishedAt?: Date | null;
  appointmentId?: Uuid;
  answers?: TaskAnswer[];
  name?: string;
}

export const makeSession = (options: SessionOptions) => {
  const startedAt = options.startedAt ?? new Date("2026-11-10T13:00:00.000Z");
  const finishedAt =
    options.finishedAt === null
      ? undefined
      : options.finishedAt ?? new Date(startedAt.getTime() + 40 * 60000);

  return new TaskNotebookSession(
    Uuid.random(),
    options.studentId,
    options.educatorId,
    options.name ?? "Sessão de leitura",
    startedAt,
    finishedAt,
    options.answers ?? [],
    undefined,
    undefined,
    options.appointmentId
  );
};

const unwrapPlan = (result: ReturnType<typeof Plan.create>) => {
  if (!result.ok) throw new Error(`unexpected ${String(result.error)}`);
  return result.value;
};

export const makePdi = (educatorId: Uuid, studentId: Uuid, title = "PDI de leitura") =>
  unwrapPlan(
    Plan.create({
      educatorId,
      studentId,
      type: PlanType.PDI,
      source: PlanSource.MANUAL,
      title,
      generalObjective: "Ler frases curtas",
      startDate: "2026-11-01",
      endDate: "2027-05-01",
      goals: [{ description: "Ler sílabas" }, { description: "Ler palavras" }],
    })
  );

export const makePe = (
  educatorId: Uuid,
  studentId: Uuid,
  options: { sessionDate: string; appointmentId?: Uuid; title?: string }
) =>
  unwrapPlan(
    Plan.create({
      educatorId,
      studentId,
      type: PlanType.PE,
      source: PlanSource.MANUAL,
      title: options.title ?? "PE da sessão",
      generalObjective: "Trabalhar rimas",
      sessionDate: options.sessionDate,
      appointmentId: options.appointmentId,
      goals: [
        { description: "Identificar rimas", successCriterion: "4 de 5" },
        { description: "Produzir rimas" },
      ],
    })
  );

export const closePlan = (plan: Plan) => {
  const closed = plan.close(PlanStatus.COMPLETED);
  if (!closed.ok) throw new Error(closed.error);
  return closed.value;
};

// Aluno com todos os dados identificáveis preenchidos, para os specs de IA
// provarem que nada disso chega ao provedor (IA-05).
export const IDENTIFIABLE = {
  name: "Joaozinho Fixture Pereira",
  phone: "11987654321",
  zipcode: "01310100",
  road: "Avenida Paulista Fixture",
  photoUrl: "https://bucket/foto-fixture.png",
  documentUrl: "https://bucket/laudo-fixture.pdf",
};

export const makeIdentifiableStudent = (educatorId: Uuid) =>
  Student.create({
    name: IDENTIFIABLE.name,
    age: 7,
    gender: Gender.Male,
    zipcode: IDENTIFIABLE.zipcode,
    road: IDENTIFIABLE.road,
    housenumber: "1578",
    phonenumber: IDENTIFIABLE.phone,
    learningTopics: ["leitura"],
    educators: [],
    educatorId,
    photoUrl: IDENTIFIABLE.photoUrl,
    documents: [
      {
        id: "doc-1",
        name: "laudo-fixture.pdf",
        url: IDENTIFIABLE.documentUrl,
        uploadedAt: new Date(),
      },
    ],
  });

// Confere que o argumento enviado à IA não carrega dados identificáveis.
export const expectNoIdentifiableData = (aiArgument: unknown) => {
  const serialized = JSON.stringify(aiArgument);
  // A chave "name" não entra aqui: o nome da escala vai à IA (IN-03). O valor
  // do nome do aluno é conferido logo abaixo.
  for (const key of [
    "studentName",
    "phonenumber",
    "road",
    "zipcode",
    "housenumber",
    "documents",
    "photoUrl",
    "educatorId",
  ]) {
    expect(serialized).not.toContain(`"${key}"`);
  }
  for (const value of Object.values(IDENTIFIABLE)) {
    expect(serialized).not.toContain(value);
  }
  expect(serialized).not.toContain("laudo-fixture");
  expect(serialized).not.toContain("foto-fixture");
};
