import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { isMultipleChoiceType, Task, TaskType } from "./task";

export const ACTIVITY_RESULT_MAX_ATTEMPTS = 50;
export const ACTIVITY_RESULT_MAX_ERRORS = 50;
export const ACTIVITY_RESULT_MAX_DURATION_MS = 3_600_000;

export type ActivityResultError =
  | "USE_ANSWER_ROUTE"
  | "PRINTABLE_NOT_PLAYABLE"
  | "INVALID_ACTIVITY_RESULT";

export interface ActivityResultProps {
  id: Uuid;
  sessionId: Uuid;
  taskId: Uuid;
  taskType: TaskType;
  completed: boolean;
  correct: boolean;
  attempts: number;
  errors: number;
  durationMs: number;
  recordedAt: Date;
}

export interface CreateActivityResultProps {
  sessionId: Uuid;
  task: Task;
  completed: boolean;
  correct: boolean;
  attempts: number;
  errors: number;
  durationMs: number;
}

const inRange = (value: number, min: number, max: number) =>
  Number.isInteger(value) && value >= min && value <= max;

// Resultado de um jogo (tipos jogáveis novos) numa sessão. Fica fora das
// respostas da sessão: não entra no accuracy das análises (RS-05).
export class ActivityResult {
  private constructor(private readonly props: ActivityResultProps) {}

  static create(props: CreateActivityResultProps) {
    const { task } = props;
    // RS-03: múltipla escolha vai pela rota de resposta; imprimível não é jogado.
    if (isMultipleChoiceType(task.type)) {
      return failure<ActivityResultError>("USE_ANSWER_ROUTE");
    }
    if (task.isPrintable) return failure<ActivityResultError>("PRINTABLE_NOT_PLAYABLE");

    if (
      !inRange(props.attempts, 1, ACTIVITY_RESULT_MAX_ATTEMPTS) ||
      !inRange(props.errors, 0, ACTIVITY_RESULT_MAX_ERRORS) ||
      !inRange(props.durationMs, 0, ACTIVITY_RESULT_MAX_DURATION_MS)
    ) {
      return failure<ActivityResultError>("INVALID_ACTIVITY_RESULT");
    }

    return success(
      new ActivityResult({
        id: Uuid.random(),
        sessionId: props.sessionId,
        taskId: task.id,
        taskType: task.type,
        completed: props.completed,
        correct: props.correct,
        attempts: props.attempts,
        errors: props.errors,
        durationMs: props.durationMs,
        recordedAt: new Date(),
      })
    );
  }

  static fromPersistence(props: ActivityResultProps): ActivityResult {
    return new ActivityResult(props);
  }

  get id(): Uuid {
    return this.props.id;
  }

  get sessionId(): Uuid {
    return this.props.sessionId;
  }

  get taskId(): Uuid {
    return this.props.taskId;
  }

  get taskType(): TaskType {
    return this.props.taskType;
  }

  get completed(): boolean {
    return this.props.completed;
  }

  get correct(): boolean {
    return this.props.correct;
  }

  get attempts(): number {
    return this.props.attempts;
  }

  get errors(): number {
    return this.props.errors;
  }

  get durationMs(): number {
    return this.props.durationMs;
  }

  get recordedAt(): Date {
    return this.props.recordedAt;
  }
}

// activitySummary do relatório da sessão (RS-05).
export function summarizeActivityResults(results: ActivityResult[]) {
  return {
    total: results.length,
    completed: results.filter((result) => result.completed).length,
    correct: results.filter((result) => result.correct).length,
  };
}
