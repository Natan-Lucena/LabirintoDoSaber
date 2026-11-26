// Carga do banco de atividades: catálogo de habilidades (task-library/skills.json)
// e biblioteca de atividades prontas (task-library/tasks.json). Usado por
// scripts/seed-task-library.ts. Idempotente: cria o que falta, atualiza o que
// mudou no arquivo e não apaga nada (cadernos e grupos podem usar as tarefas).
import { readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import { z } from "zod";
import {
  Task,
  TaskCategory,
  TaskSource,
  TaskTone,
  TaskType,
} from "../../domain/entities/task";
import { TASK_LIBRARY_NAMESPACE, TaskSkill } from "../../domain/entities/task-skill";
import { TaskRepositoryImpl } from "../repositories/prisma/task-repository-impl";
import { TaskSkillRepositoryImpl } from "../repositories/prisma/task-skill-repository-impl";

const text = z.string().trim().min(1);

const skillsFileSchema = z.array(
  z
    .object({
      code: text,
      label: text,
      order: z.number().int(),
      learningTopics: z.array(text).min(1),
    })
    .strict()
);

const tasksFileSchema = z.array(
  z
    .object({
      key: z.string().regex(/^[a-z0-9-]+$/, "use minúsculas, números e hífen"),
      category: z.nativeEnum(TaskCategory),
      type: z.nativeEnum(TaskType),
      prompt: text,
      skills: z.array(text).default([]),
      theme: text.optional(),
      tone: z.nativeEnum(TaskTone).optional(),
      alternatives: z
        .array(z.object({ text, isCorrect: z.boolean() }).strict())
        .optional(),
      content: z.unknown().optional(),
    })
    .strict()
);

export interface TaskLibraryFiles {
  skills: unknown;
  tasks: unknown;
}

interface SeedCounts {
  created: string[];
  updated: string[];
  unchanged: string[];
}

export interface TaskLibrarySeedReport {
  skills: SeedCounts;
  tasks: SeedCounts;
}

export class TaskLibrarySeedError extends Error {
  constructor(readonly errors: string[]) {
    super(`Seed do banco de atividades abortado:\n- ${errors.join("\n- ")}`);
    this.name = "TaskLibrarySeedError";
  }
}

export function loadTaskLibraryFiles(directory: string): TaskLibraryFiles {
  const read = (name: string) =>
    JSON.parse(readFileSync(path.join(directory, name), "utf-8")) as unknown;
  return { skills: read("skills.json"), tasks: read("tasks.json") };
}

// Id estável por chave: rodar de novo encontra a mesma tarefa.
export const libraryTaskId = (key: string) =>
  Uuid.fromSeed(`task-library:${key}`, TASK_LIBRARY_NAMESPACE);

// JSON com chaves ordenadas e sem undefined/null: compara conteúdo, não forma.
function canonical(value: unknown): string {
  const normalize = (current: unknown): unknown => {
    if (Array.isArray(current)) return current.map(normalize);
    if (current && typeof current === "object") {
      return Object.fromEntries(
        Object.entries(current as Record<string, unknown>)
          .filter(([, entry]) => entry !== undefined && entry !== null)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, entry]) => [key, normalize(entry)])
      );
    }
    return current;
  };
  return JSON.stringify(normalize(JSON.parse(JSON.stringify(value))));
}

const taskFingerprint = (task: Task) => canonical({ ...task, createdAt: undefined });

// Valida tudo antes de gravar qualquer coisa.
export async function seedTaskLibrary(
  prisma: PrismaClient,
  files: TaskLibraryFiles
): Promise<TaskLibrarySeedReport> {
  const skillRepository = new TaskSkillRepositoryImpl(prisma);
  const taskRepository = new TaskRepositoryImpl(prisma);
  const errors: string[] = [];

  const skills: TaskSkill[] = [];
  const parsedSkills = skillsFileSchema.safeParse(files.skills);
  if (!parsedSkills.success) {
    for (const issue of parsedSkills.error.issues) {
      errors.push(`skills.json: INVALID_SHAPE: ${issue.path.join(".")} ${issue.message}`);
    }
  } else {
    for (const definition of parsedSkills.data) {
      if (skills.some((skill) => skill.code === definition.code)) {
        errors.push(`skills.json: DUPLICATE_SKILL: ${definition.code}`);
        continue;
      }
      const created = TaskSkill.create(definition);
      if (!created.ok) {
        errors.push(...created.error.errors.map((error) => `skills.json: ${error}`));
        continue;
      }
      skills.push(created.value);
    }
  }
  const skillCodes = new Set(skills.map((skill) => skill.code));

  const tasks: { key: string; task: Task }[] = [];
  const parsedTasks = tasksFileSchema.safeParse(files.tasks);
  if (!parsedTasks.success) {
    for (const issue of parsedTasks.error.issues) {
      errors.push(`tasks.json: INVALID_SHAPE: ${issue.path.join(".")} ${issue.message}`);
    }
  } else {
    for (const definition of parsedTasks.data) {
      const label = `tasks.json: ${definition.key}`;
      if (tasks.some((entry) => entry.key === definition.key)) {
        errors.push(`${label}: DUPLICATE_KEY`);
        continue;
      }
      const unknownSkills = definition.skills.filter((code) => !skillCodes.has(code));
      if (unknownSkills.length > 0) {
        errors.push(`${label}: INVALID_SKILL: ${unknownSkills.join(", ")}`);
        continue;
      }

      const id = libraryTaskId(definition.key);
      const created = Task.create({
        id,
        source: TaskSource.Library,
        category: definition.category,
        type: definition.type,
        prompt: definition.prompt,
        skills: definition.skills,
        theme: definition.theme,
        tone: definition.tone,
        content: definition.content,
        alternatives: definition.alternatives?.map((alternative, index) => ({
          ...alternative,
          id: Uuid.fromSeed(`${id.value}:alternative:${index}`, TASK_LIBRARY_NAMESPACE),
        })),
      });
      if (!created.ok) {
        const error = created.error;
        errors.push(
          typeof error === "object"
            ? `${label}: ${error.code}: ${error.errors.map((e) => `${e.field} ${e.message}`).join("; ")}`
            : `${label}: ${error}`
        );
        continue;
      }
      // A biblioteca do seed não traz mídia (AT-05 exige URL do armazenamento).
      if (created.value.mediaUrls.length > 0) {
        errors.push(`${label}: MEDIA_NOT_ALLOWED: ${created.value.mediaUrls.map((m) => m.field).join(", ")}`);
        continue;
      }
      tasks.push({ key: definition.key, task: created.value });
    }
  }

  if (errors.length > 0) throw new TaskLibrarySeedError(errors);

  const report: TaskLibrarySeedReport = {
    skills: { created: [], updated: [], unchanged: [] },
    tasks: { created: [], updated: [], unchanged: [] },
  };

  const existingSkills = new Map(
    (await skillRepository.listAll()).map((skill) => [skill.id.value, skill])
  );
  const skillsToSave: TaskSkill[] = [];
  for (const skill of skills) {
    const existing = existingSkills.get(skill.id.value);
    const bucket = !existing
      ? report.skills.created
      : canonical({ ...existing.toJSON(), order: existing.order }) ===
          canonical({ ...skill.toJSON(), order: skill.order })
        ? report.skills.unchanged
        : report.skills.updated;
    bucket.push(skill.code);
    if (bucket !== report.skills.unchanged) skillsToSave.push(skill);
  }

  const existingTasks = new Map(
    (await taskRepository.getByIds(tasks.map(({ task }) => task.id))).map((task) => [
      task.id.value,
      task,
    ])
  );
  const tasksToSave: Task[] = [];
  for (const { key, task } of tasks) {
    const existing = existingTasks.get(task.id.value);
    if (!existing) {
      report.tasks.created.push(key);
      tasksToSave.push(task);
    } else if (taskFingerprint(existing) === taskFingerprint(task)) {
      report.tasks.unchanged.push(key);
    } else {
      report.tasks.updated.push(key);
      // Mantém a data de criação (ordem do catálogo).
      tasksToSave.push(Task.fromPersistence({ ...task, createdAt: existing.createdAt }));
    }
  }

  for (const skill of skillsToSave) await skillRepository.save(skill);
  for (const task of tasksToSave) await taskRepository.save(task);

  return report;
}
