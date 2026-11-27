import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { TaskNotebookRepository } from "../../../../../domain/repositories/task-notebook-repository";
import { isMultipleChoiceType } from "../../../../../domain/entities/task";
import { TaskGroupRepository } from "../../../../../domain/repositories/task-group-repository";
import { TaskAnswer } from "../../../../../domain/entities/task-notebook-session";
import { assertTaskAllowedInSession } from "../session-task-access";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { loadAccessibleSession } from "../../../session-evolution/use-cases/evolution-access";

export interface AnswerTaskNotebookSessionUseCaseRequest {
  educatorId: Uuid;
  sessionId: string;
  taskId: string;
  selectedAlternativeId: string;
  timeToAnswer: number; // em milissegundos
}

export class AnswerTaskNotebookSessionUseCase {
  constructor(
    private sessionRepository: TaskNotebookSessionRepository,
    private studentAccess: StudentAccessService,
    private taskRepository: TaskRepository,
    private notebookRepository: TaskNotebookRepository,
    private taskGroupRepository: TaskGroupRepository
  ) {}

  async execute(request: AnswerTaskNotebookSessionUseCaseRequest) {
    // RS-08: só quem acessa o aluno (dono ou compartilhado) responde.
    const access = await loadAccessibleSession(
      this.sessionRepository,
      this.studentAccess,
      request.sessionId,
      request.educatorId
    );
    if (!access.ok) return access;
    const { session } = access.value;

    const alternativeId = new Uuid(request.selectedAlternativeId);
    const task = Uuid.isValid(request.taskId)
      ? await this.taskRepository.getById(new Uuid(request.taskId))
      : null;

    if (session.finishedAt) {
      return failure("SESSION_ALREADY_FINISHED");
    }

    if (!task) {
      return failure("TASK_NOT_FOUND");
    }

    // AT-10: imprimível não é jogado na sessão.
    if (task.isPrintable) {
      return failure("PRINTABLE_NOT_PLAYABLE");
    }

    // Tipos jogáveis novos têm a rota própria de resultado (RS-03).
    if (!isMultipleChoiceType(task.type)) {
      return failure("USE_ACTIVITY_RESULT_ROUTE");
    }

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

    const alreadyAnswered = session.answers.some(
      (a) => a.taskId.value === task.id.value
    );

    if (alreadyAnswered) {
      return failure("TASK_ALREADY_ANSWERED");
    }

    const correctAlt = task.alternatives.find((a) => a.isCorrect);

    const isCorrect = correctAlt?.id?.value === alternativeId.value;

    const answer: TaskAnswer = {
      taskId: task.id,
      selectedAlternativeId: alternativeId,
      isCorrect,
      timeToAnswer: request.timeToAnswer,
      answeredAt: new Date(),
    };

    const updated = session.answerTask(answer);

    if (!updated.ok) {
      return failure("ANSWER_CREATION_FAILED");
    }

    await this.sessionRepository.save(updated.value);

    return success(updated.value);
  }
}
