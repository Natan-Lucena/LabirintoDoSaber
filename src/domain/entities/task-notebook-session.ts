import { failure, success, Uuid } from "@wave-telecom/framework/core";

export interface TaskAnswer {
  taskId: Uuid;
  selectedAlternativeId: Uuid;
  isCorrect: boolean;
  timeToAnswer: number; // em milissegundos (antes de 2026-10-09, em segundos)
  answeredAt: Date;
}

// O app envia timeToAnswer em milissegundos desde 2026-10-09 (São Paulo).
// As respostas anteriores estão em segundos e não foram migradas.
export const TIME_TO_ANSWER_IN_MS_SINCE = new Date("2026-10-09T00:00:00.000-03:00");

// Tempo da resposta em milissegundos, ou undefined para os dados antigos.
export function timeToAnswerInMs(answer: TaskAnswer): number | undefined {
  return answer.answeredAt >= TIME_TO_ANSWER_IN_MS_SINCE ? answer.timeToAnswer : undefined;
}

export class TaskNotebookSession {
  constructor(
    public readonly id: Uuid,
    public readonly studentId: Uuid,
    public readonly educatorId: Uuid,
    public readonly name: string,
    public readonly startedAt: Date,
    public readonly finishedAt?: Date,
    public readonly answers: TaskAnswer[] = [],
    public readonly observation?: string,
    public readonly taskNotebookId?: Uuid,
    public readonly appointmentId?: Uuid
  ) {}

  static start(
    studentId: Uuid,
    name: string,
    educatorId: Uuid,
    taskNotebookId?: Uuid,
    appointmentId?: Uuid
  ) {
    return success(
      new TaskNotebookSession(
        Uuid.random(),
        studentId,
        educatorId,
        name,
        new Date(),
        undefined,
        [],
        undefined,
        taskNotebookId,
        appointmentId
      )
    );
  }

  public answerTask(answer: TaskAnswer) {
    const exists = this.answers.some(
      (a) => a.taskId.value === answer.taskId.value
    );
    if (exists) return failure("TASK_ALREADY_ANSWERED");

    const updated = new TaskNotebookSession(
      this.id,
      this.studentId,
      this.educatorId,
      this.name,
      this.startedAt,
      this.finishedAt,
      [...this.answers, answer],
      this.observation,
      this.taskNotebookId,
      this.appointmentId
    );
    return success(updated);
  }

  public finish() {
    return success(
      new TaskNotebookSession(
        this.id,
        this.studentId,
        this.educatorId,
        this.name,
        this.startedAt,
        new Date(),
        this.answers,
        this.observation,
        this.taskNotebookId,
        this.appointmentId
      )
    );
  }

  public addObservation(observation: string) {
    if (!this.finishedAt) return failure("SESSION_NOT_FINISHED");

    return success(
      new TaskNotebookSession(
        this.id,
        this.studentId,
        this.educatorId,
        this.name,
        this.startedAt,
        this.finishedAt,
        this.answers,
        observation,
        this.taskNotebookId,
        this.appointmentId
      )
    );
  }

  // Usado pela evolução (EV-08) para copiar o registro descritivo. Ao
  // contrário de addObservation, não confere se a sessão foi finalizada.
  public withObservation(observation: string) {
    return new TaskNotebookSession(
      this.id,
      this.studentId,
      this.educatorId,
      this.name,
      this.startedAt,
      this.finishedAt,
      this.answers,
      observation,
      this.taskNotebookId,
      this.appointmentId
    );
  }
}
