import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { ActivityResult } from "../../../../../domain/entities/activity-result";
import {
  ActivityResultAlreadyExistsError,
  ActivityResultRepository,
} from "../../../../../domain/repositories/activity-result-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { TaskGroupRepository } from "../../../../../domain/repositories/task-group-repository";
import { TaskNotebookRepository } from "../../../../../domain/repositories/task-notebook-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { loadOwnedSession } from "../../../session-evolution/use-cases/evolution-access";
import { assertTaskAllowedInSession } from "../session-task-access";

export interface RecordActivityResultUseCaseRequest {
  educatorId: Uuid;
  sessionId: string;
  taskId: string;
  completed: boolean;
  correct: boolean;
  attempts: number;
  errors: number;
  durationMs: number;
}

const alreadyExists = (resultId?: string) =>
  failure({ code: "RESULT_ALREADY_EXISTS" as const, resultId });

export class RecordActivityResultUseCase {
  constructor(
    private sessionRepository: TaskNotebookSessionRepository,
    private studentRepository: StudentRepository,
    private taskRepository: TaskRepository,
    private notebookRepository: TaskNotebookRepository,
    private taskGroupRepository: TaskGroupRepository,
    private resultRepository: ActivityResultRepository
  ) {}

  async execute(request: RecordActivityResultUseCaseRequest) {
    // RS-08: acesso pelo dono atual do aluno, não pelo educador da sessão.
    const access = await loadOwnedSession(
      this.sessionRepository,
      this.studentRepository,
      request.sessionId,
      request.educatorId
    );
    if (!access.ok) return access;
    const { session } = access.value;

    if (session.finishedAt) return failure("SESSION_ALREADY_FINISHED");

    const task = Uuid.isValid(request.taskId)
      ? await this.taskRepository.getById(new Uuid(request.taskId))
      : null;
    if (!task) return failure("TASK_NOT_FOUND");

    const created = ActivityResult.create({
      sessionId: session.id,
      task,
      completed: request.completed,
      correct: request.correct,
      attempts: request.attempts,
      errors: request.errors,
      durationMs: request.durationMs,
    });
    if (!created.ok) return created;
    const result = created.value;

    const allowed = await assertTaskAllowedInSession(
      {
        notebookRepository: this.notebookRepository,
        taskGroupRepository: this.taskGroupRepository,
        taskRepository: this.taskRepository,
      },
      session,
      task,
      request.educatorId
    );
    if (!allowed.ok) return allowed;

    const existing = await this.resultRepository.findBySessionAndTask(session.id, task.id);
    if (existing) return alreadyExists(existing.id.value);

    try {
      await this.resultRepository.save(result);
    } catch (error) {
      // Envio em paralelo: a outra requisição gravou primeiro (RS-04).
      if (!(error instanceof ActivityResultAlreadyExistsError)) throw error;
      const winner = await this.resultRepository.findBySessionAndTask(session.id, task.id);
      return alreadyExists(winner?.id.value);
    }

    return success(result);
  }
}
