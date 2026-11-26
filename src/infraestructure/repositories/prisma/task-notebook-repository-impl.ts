import {
  PrismaClient,
  Prisma,
  $Enums as PrismaEnums,
  Task as PrismaTask,
} from "@prisma/client";
import {
  TaskNotebookRepository,
  SearchTaskNotebookProps,
} from "../../../domain/repositories/task-notebook-repository";
import {
  TaskNotebook,
  TaskNotebookCategory,
} from "../../../domain/entities/task-notebook";
import { Uuid } from "@wave-telecom/framework/core";
import { Educator } from "../../../domain/entities/educator";
import { mapPrismaTaskToEntity } from "./task-repository-impl";

type PrismaNotebook = Prisma.TaskNotebookGetPayload<{
  include: { educator: true; tasks: true };
}>;

const CATEGORY_TO_PRISMA: Record<TaskNotebookCategory, PrismaEnums.TaskNotebookCategory> = {
  [TaskNotebookCategory.Reading]: PrismaEnums.TaskNotebookCategory.Reading,
  [TaskNotebookCategory.Writing]: PrismaEnums.TaskNotebookCategory.Writing,
  [TaskNotebookCategory.Vocabulary]: PrismaEnums.TaskNotebookCategory.Vocabulary,
  [TaskNotebookCategory.Comprehension]: PrismaEnums.TaskNotebookCategory.Comprehension,
};

const CATEGORY_FROM_PRISMA = Object.fromEntries(
  Object.entries(CATEGORY_TO_PRISMA).map(([key, value]) => [value, key])
) as Record<PrismaEnums.TaskNotebookCategory, TaskNotebookCategory>;

export class TaskNotebookRepositoryImpl implements TaskNotebookRepository {
  constructor(private prismaService: PrismaClient) {}

  // As tasks ficam em `taskIds` (uma task da biblioteca pode estar em vários
  // cadernos). Cadernos antigos continuam com a relação `tasks`, que a
  // leitura junta aos ids.
  async save(taskNotebook: TaskNotebook): Promise<TaskNotebook> {
    const data = {
      taskGroupsIds: taskNotebook.taskGroupsIds,
      taskIds: taskNotebook.tasks.map((task) => task.id.value),
      educatorId: taskNotebook.educator.id.value,
      category: CATEGORY_TO_PRISMA[taskNotebook.category],
      description: taskNotebook.description,
    };

    const prismaNotebook = await this.prismaService.taskNotebook.upsert({
      where: { id: taskNotebook.id.value },
      update: data,
      create: {
        id: taskNotebook.id.value,
        createdAt: taskNotebook.createdAt,
        ...data,
      },
      include: {
        educator: true,
        tasks: true,
      },
    });

    const [notebook] = await this.mapToEntities([prismaNotebook]);
    return notebook;
  }

  async getById(id: Uuid): Promise<TaskNotebook | null> {
    const prismaNotebook = await this.prismaService.taskNotebook.findUnique({
      where: { id: id.value },
      include: {
        educator: true,
        tasks: true,
      },
    });

    if (!prismaNotebook) return null;

    const [notebook] = await this.mapToEntities([prismaNotebook]);
    return notebook;
  }

  async search(props: SearchTaskNotebookProps): Promise<TaskNotebook[]> {
    const prismaNotebooks = await this.prismaService.taskNotebook.findMany({
      where: {
        id: props.id?.value,
        educatorId: props.educatorId?.value,
        category: props.category ? CATEGORY_TO_PRISMA[props.category] : undefined,
        description: props.descriptionContains
          ? { contains: props.descriptionContains, mode: "insensitive" }
          : undefined,
      },
      include: {
        educator: true,
        tasks: true,
      },
    });

    return this.mapToEntities(prismaNotebooks);
  }

  async delete(id: Uuid): Promise<void> {
    await this.prismaService.taskNotebook.delete({
      where: { id: id.value },
    });
  }

  // Uma busca só para as tasks de `taskIds` de todos os cadernos.
  private async mapToEntities(prismaNotebooks: PrismaNotebook[]): Promise<TaskNotebook[]> {
    const related = new Set(
      prismaNotebooks.flatMap((notebook) => notebook.tasks.map((task) => task.id))
    );
    const missingIds = Array.from(
      new Set(
        prismaNotebooks
          .flatMap((notebook) => notebook.taskIds ?? [])
          .filter((id) => !related.has(id))
      )
    );
    const extraTasks =
      missingIds.length > 0
        ? await this.prismaService.task.findMany({ where: { id: { in: missingIds } } })
        : [];
    const taskById = new Map<string, PrismaTask>(
      [...prismaNotebooks.flatMap((notebook) => notebook.tasks), ...extraTasks].map((task) => [
        task.id,
        task,
      ])
    );

    return prismaNotebooks.map((notebook) => {
      const ids = Array.from(
        new Set([...(notebook.taskIds ?? []), ...notebook.tasks.map((task) => task.id)])
      );
      const tasks = ids
        .map((id) => taskById.get(id))
        .filter((task): task is PrismaTask => !!task)
        .map(mapPrismaTaskToEntity);
      return this.mapToEntity(notebook, tasks);
    });
  }

  private mapToEntity(prismaNotebook: PrismaNotebook, tasks: TaskNotebook["tasks"]): TaskNotebook {
    const educator = Educator.create({
      id: new Uuid(prismaNotebook.educator.id),
      name: prismaNotebook.educator.name,
      email: prismaNotebook.educator.email,
      password: prismaNotebook.educator.password,
      createdAt: prismaNotebook.educator.createdAt,
      photoUrl: prismaNotebook.educator.photoUrl ?? undefined,
      contact: prismaNotebook.educator.contact ?? undefined,
      profession: prismaNotebook.educator.profession ?? undefined,
    });

    const result = TaskNotebook.create({
      id: new Uuid(prismaNotebook.id),
      educator,
      tasks,
      category: CATEGORY_FROM_PRISMA[prismaNotebook.category],
      description: prismaNotebook.description,
      createdAt: prismaNotebook.createdAt,
      taskGroupsIds: prismaNotebook.taskGroupsIds,
    });

    if (!result.ok)
      throw new Error("Erro ao mapear TaskNotebook de Prisma para domínio");
    return result.value;
  }
}
