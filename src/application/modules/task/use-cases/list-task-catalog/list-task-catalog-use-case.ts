import { failure, success, Uuid } from "@wave-telecom/framework/core";
import {
  Task,
  TaskCategory,
  TaskFormat,
  TaskSource,
  TaskType,
} from "../../../../../domain/entities/task";
import { TaskSkill } from "../../../../../domain/entities/task-skill";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { TaskSkillRepository } from "../../../../../domain/repositories/task-skill-repository";
import { normalizeText } from "../../../../../domain/utils/text";
import { mapTaskSummary } from "../../../../../infraestructure/mappers/map-task";
import { decodeTaskCatalogCursor, encodeTaskCatalogCursor } from "./task-catalog-cursor";

export interface ListTaskCatalogUseCaseRequest {
  educatorId: Uuid;
  search?: string;
  format?: TaskFormat;
  type?: TaskType;
  skill?: string;
  category?: TaskCategory;
  source?: TaskSource;
  limit: number;
  cursor?: string;
}

// Mais recentes primeiro; o id desempata.
export const compareNewestFirst = (a: Task, b: Task) =>
  b.createdAt.getTime() - a.createdAt.getTime() || b.id.value.localeCompare(a.id.value);

// Catálogo = biblioteca + tarefas do educador. Os dois conjuntos são pequenos
// (dezenas a centenas), então os filtros e a busca sem acento rodam em memória.
export class ListTaskCatalogUseCase {
  constructor(
    private taskRepository: TaskRepository,
    private skillRepository: TaskSkillRepository
  ) {}

  async execute(request: ListTaskCatalogUseCaseRequest) {
    const cursor = request.cursor ? decodeTaskCatalogCursor(request.cursor) : undefined;
    if (request.cursor && !cursor) return failure("INVALID_CURSOR" as const);

    const [library, own, skills] = await Promise.all([
      request.source === TaskSource.Educator ? [] : this.taskRepository.listLibrary(),
      request.source === TaskSource.Library
        ? []
        : this.taskRepository.listByEducator(request.educatorId),
      this.skillRepository.listAll(),
    ]);
    const skillsByCode = new Map(skills.map((skill) => [skill.code, skill]));
    const search = request.search ? normalizeText(request.search) : undefined;

    const matching = [...library, ...own]
      .filter(
        (task) =>
          (!request.format || task.format === request.format) &&
          (!request.type || task.type === request.type) &&
          (!request.category || task.category === request.category) &&
          (!request.skill || task.skills.includes(request.skill)) &&
          (!search || searchableText(task, skillsByCode).includes(search))
      )
      .sort(compareNewestFirst);

    const start = cursor
      ? matching.findIndex(
          (task) =>
            task.createdAt.getTime() < cursor.createdAt.getTime() ||
            (task.createdAt.getTime() === cursor.createdAt.getTime() &&
              task.id.value.localeCompare(cursor.id) < 0)
        )
      : 0;
    const rest = start < 0 ? [] : matching.slice(start);
    const page = rest.slice(0, request.limit);
    const last = page[page.length - 1];

    return success({
      items: page.map((task) => mapTaskSummary(task, skillsByCode)),
      ...(rest.length > request.limit && last
        ? { nextCursor: encodeTaskCatalogCursor({ createdAt: last.createdAt, id: last.id.value }) }
        : {}),
    });
  }
}

// AT-09: prompt, theme, título do conteúdo e rótulo das habilidades.
function searchableText(task: Task, skillsByCode: Map<string, TaskSkill>): string {
  return normalizeText(
    [
      task.prompt,
      task.theme ?? "",
      task.title,
      ...task.skills.map((code) => skillsByCode.get(code)?.label ?? ""),
    ].join(" \u0000 ")
  );
}
