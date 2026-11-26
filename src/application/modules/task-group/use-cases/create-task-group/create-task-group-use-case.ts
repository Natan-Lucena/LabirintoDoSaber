import { failure, success } from "@wave-telecom/framework/core";
import { TaskCategory } from "../../../../../domain/entities/task";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { TaskGroupRepository } from "../../../../../domain/repositories/task-group-repository";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { TaskGroup } from "../../../../../domain/entities/task-group";
import { hasPrintableTask } from "../task-group-rules";

interface CreateTaskGroupUseCaseRequest {
  name: string;
  tasksIds?: string[];
  educatorEmail: string;
  category: TaskCategory;
}

export class CreateTaskGroupUseCase {
  constructor(
    private taskGroupRepository: TaskGroupRepository,
    private educatorRepository: EducatorRepository,
    private taskRepository: TaskRepository
  ) {}

  async execute(request: CreateTaskGroupUseCaseRequest) {
    const educatorExists = await this.educatorRepository.getByEmail(
      request.educatorEmail
    );

    if (!educatorExists) {
      return failure("EDUCATOR_NOT_FOUND");
    }

    if (await hasPrintableTask(this.taskRepository, request.tasksIds)) {
      return failure("PRINTABLE_NOT_PLAYABLE");
    }

    const taskGroup = TaskGroup.create({
      name: request.name,
      tasksIds: request.tasksIds,
      educatorId: educatorExists.id,
      category: request.category,
    });
    await this.taskGroupRepository.save(taskGroup);
    return success(taskGroup);
  }
}
