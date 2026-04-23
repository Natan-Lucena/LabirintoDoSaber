import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";

interface GetTaskByIdUseCaseRequest {
    taskId: Uuid;
}

export class GetTaskByIdUseCase {
    constructor(private taskRepository: TaskRepository) {}

    async execute(params: GetTaskByIdUseCaseRequest) {
        try {
            if (!params.taskId) {
                return failure("TASK_ID_REQUIRED");
            }

            const idAsString = String(params.taskId);
            if (!Uuid.isValid(idAsString)) {
                return failure("INVALID_TASK_ID");
            }

            const task = await this.taskRepository.getById(params.taskId);
            if (!task) {
                return failure("TASK_NOT_FOUND");
            }

            return success(task);
        } catch {
            return failure("GET_TASK_FAILED");
        }
    }
}
