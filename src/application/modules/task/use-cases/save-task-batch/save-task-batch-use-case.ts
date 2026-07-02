import { failure, success } from "@wave-telecom/framework/core";
import {
  Task,
  TaskCategory,
  TaskType,
} from "../../../../../domain/entities/task";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { TaskGroupRepository } from "../../../../../domain/repositories/task-group-repository";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { TaskGroup } from "../../../../../domain/entities/task-group";

interface TaskInput {
  category: TaskCategory;
  type: TaskType;
  prompt: string;
  alternatives: { text: string; isCorrect: boolean }[];
  imageFile?: string;
  audioFile?: string;
}

interface SaveTaskBatchUseCaseRequest {
  name: string;
  category: TaskCategory;
  tasks: TaskInput[];
  educatorEmail: string;
}

export class SaveTaskBatchUseCase {
  constructor(
    private taskRepository: TaskRepository,
    private taskGroupRepository: TaskGroupRepository,
    private educatorRepository: EducatorRepository
  ) {}

  async execute(request: SaveTaskBatchUseCaseRequest) {
    if (!request.tasks || request.tasks.length === 0) {
      return failure("EMPTY_TASK_LIST");
    }

    const educator = await this.educatorRepository.getByEmail(
      request.educatorEmail
    );

    if (!educator) {
      return failure("EDUCATOR_NOT_FOUND");
    }

    // Constrói/valida todas as atividades antes de persistir. As invariantes de
    // mídia e de alternativas ficam a cargo de Task.create (origem-agnóstico:
    // gerada por IA ou criada na mão, com ou sem mídia).
    const tasks: Task[] = [];
    for (const input of request.tasks) {
      const taskResult = Task.create({
        category: input.category,
        type: input.type,
        prompt: input.prompt,
        alternatives: input.alternatives,
        imageFile: input.imageFile,
        audioFile: input.audioFile,
      });

      if (!taskResult.ok) {
        return failure("INVALID_TASK_DATA");
      }

      tasks.push(taskResult.value);
    }

    await this.taskRepository.saveMany(tasks);

    const taskGroup = TaskGroup.create({
      name: request.name,
      category: request.category,
      educatorId: educator.id,
      tasksIds: tasks.map((task) => task.id.value),
    });

    const savedGroup = await this.taskGroupRepository.save(taskGroup);

    return success({
      taskGroup: {
        id: savedGroup.id.value,
        name: savedGroup.name,
        category: savedGroup.category,
        educatorId: savedGroup.educatorId.value,
        tasksIds: savedGroup.tasksIds,
      },
      taskIds: tasks.map((task) => task.id.value),
    });
  }
}
