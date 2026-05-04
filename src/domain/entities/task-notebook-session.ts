import { failure, success, Uuid } from "@wave-telecom/framework/core";

export interface TaskAnswer {
  taskId: Uuid;
  selectedAlternativeId: Uuid;
  isCorrect: boolean;
  timeToAnswer: number; // em segundos
  answeredAt: Date;
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
    public readonly observation?: string
  ) {}

  static start(studentId: Uuid, name: string, educatorId: Uuid) {
    return success(
      new TaskNotebookSession(
        Uuid.random(),
        studentId,
        educatorId,
        name,
        new Date(),
        undefined,
        []
      )
    );
  }

  public answerTask(answer: TaskAnswer) {
    const exists = this.answers.some((a) => a.taskId === answer.taskId);
    if (exists) return failure("TASK_ALREADY_ANSWERED");

    const updated = new TaskNotebookSession(
      this.id,
      this.studentId,
      this.educatorId,
      this.name,
      this.startedAt,
      this.finishedAt,
      [...this.answers, answer],
      this.observation
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
        this.observation
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
        observation
      )
    );
  }
}
