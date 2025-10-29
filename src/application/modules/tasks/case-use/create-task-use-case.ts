import { failure, success } from "@wave-telecom/framework/core";
import { TaskRepository } from "../../../../domain/repositories/task-repository";
import { Task, TaskCategory, TaskType } from "../../../../domain/entities/task";

interface CreateTaskUseCaseRequest {
    category: TaskCategory;
    type: TaskType;
    prompt: string;
    alternatives: {
        text: string;
        isCorrect: boolean;
    }[];
    imageFile?: string;
    audioFile?: string;
}

export class CreateTaskUseCase {
    constructor(private taskRepository: TaskRepository) {}

    async execute(props: CreateTaskUseCaseRequest) {
        const taskResult = Task.create(props);
        if (!taskResult.ok) {
            return failure("INVALID_TASK_DATA");
        }
        
        const task = taskResult.value;

        await this.taskRepository.save(task);

        return success(void 0);
    }       
}

