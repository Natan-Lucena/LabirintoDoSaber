import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { Response } from "express";
import { Task, TaskFieldError } from "../../../../domain/entities/task";
import { TaskRepository } from "../../../../domain/repositories/task-repository";
import { TaskSkillRepository } from "../../../../domain/repositories/task-skill-repository";
import { FileStorage } from "../../../services/file-storage";

// AT-12: todo código precisa estar no catálogo.
export async function checkSkills(skillRepository: TaskSkillRepository, skills?: string[]) {
  if (!skills || skills.length === 0) return success(void 0);
  const catalog = new Set((await skillRepository.listAll()).map((skill) => skill.code));
  if (skills.some((code) => !catalog.has(code.trim()))) return failure("INVALID_SKILL" as const);
  return success(void 0);
}

// AT-05: as URLs do content vêm de POST /task/upload-media.
export function checkMediaUrls(fileStorage: FileStorage, task: Task) {
  const errors: TaskFieldError[] = task.mediaUrls
    .filter((ref) => !fileStorage.isStoredFileUrl(ref.url))
    .map((ref) => ({ field: ref.field, message: "Use uma URL de POST /task/upload-media" }));
  if (errors.length > 0) return failure({ code: "INVALID_MEDIA_URL" as const, errors });
  return success(void 0);
}

// Tarefa que o educador pode alterar (PUT, DELETE): da biblioteca → 403
// LIBRARY_TASK_READ_ONLY; de outro educador → 403 UNAUTHORIZED. Id inválido
// vira 404.
export async function loadEditableTask(
  taskRepository: TaskRepository,
  taskId: string,
  educatorId: Uuid
) {
  const task = await loadTask(taskRepository, taskId);
  if (!task.ok) return task;
  if (task.value.isLibrary) return failure("LIBRARY_TASK_READ_ONLY" as const);
  if (task.value.belongsToAnotherEducator(educatorId)) return failure("UNAUTHORIZED" as const);
  return task;
}

export async function loadTask(taskRepository: TaskRepository, taskId: string) {
  if (!Uuid.isValid(taskId)) return failure("TASK_NOT_FOUND" as const);
  const task = await taskRepository.getById(new Uuid(taskId));
  if (!task) return failure("TASK_NOT_FOUND" as const);
  return success(task);
}

const BAD_REQUEST = new Set([
  "INVALID_SKILL",
  "ALTERNATIVES_NOT_ALLOWED",
  "TYPE_CHANGE_NOT_ALLOWED",
  "INVALID_TASK_DATA",
  "INVALID_TASK_TYPE",
  "TEXT_TASK_CANNOT_HAVE_MEDIA",
  "MEDIA_TASK_REQUIRES_IMAGE_OR_AUDIO",
  "AT_LEAST_ONE_ALTERNATIVE_MUST_BE_CORRECT",
]);

export type TaskUseCaseError =
  | string
  | { code: "INVALID_CONTENT" | "INVALID_MEDIA_URL"; errors: TaskFieldError[] };

// Resposta HTTP dos erros comuns das rotas de task.
export function sendTaskError(res: Response, error: TaskUseCaseError) {
  if (typeof error === "object") {
    return res.status(400).json({ message: error.code, errors: error.errors });
  }
  if (error === "TASK_NOT_FOUND") return res.status(404).json({ message: error });
  if (error === "LIBRARY_TASK_READ_ONLY" || error === "UNAUTHORIZED") {
    return res.status(403).json({ message: error });
  }
  if (BAD_REQUEST.has(error)) return res.status(400).json({ message: error });
  return res.status(500).json({ message: error, error: "Error not specified." });
}
