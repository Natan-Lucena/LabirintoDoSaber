// Fábricas de entidades reais para os specs do módulo de evolução.
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
