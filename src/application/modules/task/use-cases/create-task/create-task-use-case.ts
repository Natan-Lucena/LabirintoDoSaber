import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { TaskSkillRepository } from "../../../../../domain/repositories/task-skill-repository";
import {
  isMultipleChoiceType,
  Task,
  TaskCategory,
  TaskFieldError,
  TaskTone,
  TaskType,
} from "../../../../../domain/entities/task";
import { FileStorage } from "../../../../services/file-storage";
import { checkMediaUrls, checkSkills } from "../task-rules";

export interface CreateTaskUseCaseRequest {
  educatorId: Uuid;
  category: TaskCategory;
  type: TaskType;
  prompt: string;
  alternatives?: {
    text: string;
    isCorrect: boolean;
  }[];
  content?: unknown;
  skills?: string[];
  theme?: string;
  tone?: TaskTone;
  imageFile?: Express.Multer.File;
  audioFile?: Express.Multer.File;
}

export class CreateTaskUseCase {
  constructor(
    private taskRepository: TaskRepository,
    private fileStorage: FileStorage,
    private skillRepository: TaskSkillRepository
  ) {}

  async execute(props: CreateTaskUseCaseRequest) {
    if (!Object.values(TaskType).includes(props.type)) {
      return failure("INVALID_TASK_TYPE");
    }

    const alternatives = props.alternatives ?? [];

    if (isMultipleChoiceType(props.type)) {
      if (props.type === TaskType.MultipleChoice && (props.imageFile || props.audioFile)) {
        return failure("TEXT_TASK_CANNOT_HAVE_MEDIA");
      }
      if (
        props.type === TaskType.MultipleChoiceWithMedia &&
        !props.imageFile &&
        !props.audioFile
      ) {
        return failure("MEDIA_TASK_REQUIRES_IMAGE_OR_AUDIO");
      }
      if (!alternatives.some((alt) => alt.isCorrect === true)) {
        return failure("AT_LEAST_ONE_ALTERNATIVE_MUST_BE_CORRECT");
      }
    } else {
      if (alternatives.length > 0) return failure("ALTERNATIVES_NOT_ALLOWED");
      // Nos tipos novos a mídia vem em content, de POST /task/upload-media.
      const fileErrors: TaskFieldError[] = [
        ...(props.imageFile ? [{ field: "imageFile", message: "Use as mídias de content" }] : []),
        ...(props.audioFile ? [{ field: "audioFile", message: "Use as mídias de content" }] : []),
      ];
      if (fileErrors.length > 0) {
        return failure({ code: "INVALID_CONTENT" as const, errors: fileErrors });
      }
    }

    const skills = await checkSkills(this.skillRepository, props.skills);
    if (!skills.ok) return skills;

    const id = Uuid.random();
    const audioUrl = props.audioFile
      ? (await this.fileStorage.saveFile({ taskId: id.value, file: props.audioFile })).url
      : undefined;
    const imageUrl = props.imageFile
      ? (await this.fileStorage.saveFile({ taskId: id.value, file: props.imageFile })).url
      : undefined;

    const taskResult = Task.create({
      id,
      educatorId: props.educatorId,
      category: props.category,
      type: props.type,
      prompt: props.prompt,
      alternatives,
      audioFile: audioUrl,
      imageFile: imageUrl,
      content: props.content,
      skills: props.skills,
      theme: props.theme,
      tone: props.tone,
    });
    if (!taskResult.ok) return taskResult;
    const task = taskResult.value;

    const media = checkMediaUrls(this.fileStorage, task);
    if (!media.ok) return media;

    await this.taskRepository.save(task);

    return success(task);
  }
}
