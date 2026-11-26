import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { Response } from "express";
import {
  isLegacyTask,
  isUsableBy,
  Task,
  TaskFieldError,
} from "../../../../domain/entities/task";
import { MediaUrlRef } from "../../../../domain/entities/task-content";
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

// AT-05: URLs de mídia vêm de POST /task/upload-media (o mesmo armazenamento).
export function checkMediaRefs(fileStorage: FileStorage, refs: MediaUrlRef[]) {
  const errors: TaskFieldError[] = refs
    .filter((ref) => !fileStorage.isStoredFileUrl(ref.url))
    .map((ref) => ({ field: ref.field, message: "Use uma URL de POST /task/upload-media" }));
  if (errors.length > 0) return failure({ code: "INVALID_MEDIA_URL" as const, errors });
  return success(void 0);
}

export function checkMediaUrls(fileStorage: FileStorage, task: Task) {
  return checkMediaRefs(fileStorage, task.mediaUrls);
}

// imageFile/audioFile da múltipla escolha enviados como URL (PUT e lote).
export function multipleChoiceMediaRefs(
  media: { imageFile?: string | null; audioFile?: string | null },
  prefix = ""
): MediaUrlRef[] {
  return [
    ...(media.imageFile ? [{ field: `${prefix}imageFile`, url: media.imageFile }] : []),
    ...(media.audioFile ? [{ field: `${prefix}audioFile`, url: media.audioFile }] : []),
  ];
}

// Regra de uso das tarefas (isUsableBy), com os donos das antigas sem dono
// numa busca só.
export async function findUnusableTask(
  taskRepository: TaskRepository,
  tasks: Task[],
  educatorId: Uuid
): Promise<Task | undefined> {
  const legacy = tasks.filter(isLegacyTask);
  const owners =
    legacy.length > 0
      ? await taskRepository.findLegacyOwners(legacy.map((task) => task.id))
      : new Map<string, string[]>();
  return tasks.find((task) => !isUsableBy(task, educatorId, owners.get(task.id.value)));
}

// Tarefa que o educador pode duplicar (biblioteca inclusive).
export async function loadUsableTask(
  taskRepository: TaskRepository,
  taskId: string,
  educatorId: Uuid
) {
  const task = await loadTask(taskRepository, taskId);
  if (!task.ok) return task;
  if (await findUnusableTask(taskRepository, [task.value], educatorId)) {
    return failure("UNAUTHORIZED" as const);
  }
  return task;
}

// Tarefa que o educador pode alterar (PUT, DELETE): da biblioteca → 403
// LIBRARY_TASK_READ_ONLY; que ele não pode usar → 403 UNAUTHORIZED. Id
// inválido vira 404.
export async function loadEditableTask(
  taskRepository: TaskRepository,
  taskId: string,
  educatorId: Uuid
) {
  const task = await loadTask(taskRepository, taskId);
  if (!task.ok) return task;
  if (task.value.isLibrary) return failure("LIBRARY_TASK_READ_ONLY" as const);
  if (await findUnusableTask(taskRepository, [task.value], educatorId)) {
    return failure("UNAUTHORIZED" as const);
  }
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
