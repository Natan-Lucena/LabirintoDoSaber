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
        if (!Object.values(TaskType).includes(props.type)) {
            return failure("INVALID_TASK_TYPE");
        }

        if (props.type === TaskType.MultipleChoice) {
            if (props.imageFile || props.audioFile) {
                return failure("TEXT_TASK_CANNOT_HAVE_MEDIA");
            }
        }

        if (props.type === TaskType.MultipleChoiceWithMedia) {
            const hasImage = !!props.imageFile;
            const hasAudio = !!props.audioFile;
            if (!hasImage && !hasAudio) {
                return failure("MEDIA_TASK_REQUIRES_IMAGE_OR_AUDIO");
            }
        }

        const hasCorrectAlternative = props.alternatives.some(
            (alt) => alt.isCorrect === true
        );

        if (!hasCorrectAlternative) {
            return failure("AT_LEAST_ONE_ALTERNATIVE_MUST_BE_CORRECT");
        }
        
        const taskResult = Task.create(props);
        if (!taskResult.ok) {
            return failure("INVALID_TASK_DATA");
        }
        
        const task = taskResult.value;

        await this.taskRepository.save(task);

        return success(void 0);
    }       
}

