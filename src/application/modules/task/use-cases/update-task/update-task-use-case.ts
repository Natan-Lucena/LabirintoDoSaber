import { success, Uuid } from "@wave-telecom/framework/core";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { TaskSkillRepository } from "../../../../../domain/repositories/task-skill-repository";
import { TaskCategory, TaskTone, TaskType } from "../../../../../domain/entities/task";
import { FileStorage } from "../../../../services/file-storage";
import {
  checkMediaRefs,
  checkSkills,
  loadEditableTask,
  multipleChoiceMediaRefs,
} from "../task-rules";

export interface UpdateTaskUseCaseRequest {
  educatorId: Uuid;
  id: string;
  category?: TaskCategory;
  type?: TaskType;
  prompt?: string;
  alternatives?: {
    text: string;
    isCorrect: boolean;
  }[];
  imageFile?: string;
  audioFile?: string;
  content?: unknown;
  skills?: string[];
  theme?: string;
  tone?: TaskTone;
}

export class UpdateTaskUseCase {
  constructor(
    private taskRepository: TaskRepository,
    private skillRepository: TaskSkillRepository,
    private fileStorage: FileStorage
  ) {}

  async execute({ educatorId, id, ...changes }: UpdateTaskUseCaseRequest) {
    const existing = await loadEditableTask(this.taskRepository, id, educatorId);
    if (!existing.ok) return existing;

    const skills = await checkSkills(this.skillRepository, changes.skills);
    if (!skills.ok) return skills;

    const updated = existing.value.updateTask(changes);
    if (!updated.ok) return updated;

    // Mídias do content e os imageFile/audioFile enviados agora (os já gravados
    // não são revalidados).
    const media = checkMediaRefs(this.fileStorage, [
      ...updated.value.mediaUrls,
      ...multipleChoiceMediaRefs(changes),
    ]);
    if (!media.ok) return media;

    await this.taskRepository.save(updated.value);

    return success(updated.value);
  }
}
