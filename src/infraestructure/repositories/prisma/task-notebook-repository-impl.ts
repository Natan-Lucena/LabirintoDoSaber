import { PrismaClient, $Enums as PrismaEnums } from "@prisma/client";
import {
  TaskNotebookRepository,
  SearchTaskNotebookProps,
} from "../../../domain/repositories/task-notebook-repository";
import {
  TaskNotebook,
  TaskNotebookCategory,
} from "../../../domain/entities/task-notebook";
import { Task, TaskCategory, TaskType } from "../../../domain/entities/task";
import { Uuid } from "@wave-telecom/framework/core";
import { Educator } from "../../../domain/entities/educator";

export class TaskNotebookRepositoryImpl implements TaskNotebookRepository {
  constructor(private prismaService: PrismaClient) {}

  /**
   * Cria ou atualiza um caderno de tarefas (TaskNotebook)
   */
  async save(taskNotebook: TaskNotebook): Promise<TaskNotebook> {
    // 🔹 Atualiza ou cria o caderno, apenas vinculando as tasks existentes
    const prismaNotebook = await this.prismaService.taskNotebook.upsert({
      where: { id: taskNotebook.id.value },
      update: {
        taskGroupsIds: taskNotebook.taskGroupsIds,
        educatorId: taskNotebook.educator.id.value,
        category: this.mapCategory(taskNotebook.category),
        description: taskNotebook.description,
        tasks: {
          connect: taskNotebook.tasks.map((task) => ({
            id: task.id.value,
          })),
        },
      },
      create: {
        id: taskNotebook.id.value,
        educatorId: taskNotebook.educator.id.value,
        category: this.mapCategory(taskNotebook.category),
        description: taskNotebook.description,
        createdAt: taskNotebook.createdAt,
        taskGroupsIds: taskNotebook.taskGroupsIds,
        tasks: {
          connect: taskNotebook.tasks.map((task) => ({
            id: task.id.value,
          })),
        },
      },
      include: {
        educator: true,
        tasks: true,
      },
    });

    return this.mapToEntity(prismaNotebook);
  }

  /**
   * Busca um TaskNotebook pelo ID
   */
  async getById(id: Uuid): Promise<TaskNotebook | null> {
    const prismaNotebook = await this.prismaService.taskNotebook.findUnique({
      where: { id: id.value },
      include: {
        educator: true,
        tasks: true,
      },
    });

    if (!prismaNotebook) return null;

    return this.mapToEntity(prismaNotebook);
  }

  /**
   * Pesquisa cadernos de tarefas com filtros opcionais
   */
  async search(props: SearchTaskNotebookProps): Promise<TaskNotebook[]> {
    const prismaNotebooks = await this.prismaService.taskNotebook.findMany({
      where: {
        id: props.id?.value,
        educatorId: props.educatorId?.value,
        category: props.category ? this.mapCategory(props.category) : undefined,
        description: props.descriptionContains
          ? { contains: props.descriptionContains, mode: "insensitive" }
          : undefined,
      },
      include: {
        educator: true,
        tasks: true,
      },
    });

    return prismaNotebooks.map((n) => this.mapToEntity(n));
  }

  /**
   * Exclui um caderno de tarefas
   */
  async delete(id: Uuid): Promise<void> {
    await this.prismaService.taskNotebook.delete({
      where: { id: id.value },
    });
  }

  // ---------- MAPEAMENTO DE ENTIDADES ----------

  private mapToEntity(prismaNotebook: any): TaskNotebook {
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

    const tasks: Task[] =
      prismaNotebook.tasks?.map((t: any) => {
        const result = Task.create({
          id: new Uuid(t.id),
          createdAt: t.createdAt,
          category: this.mapTaskCategoryFromPrisma(t.category),
          type: this.mapTaskTypeFromPrisma(t.type),
          prompt: t.prompt,
          alternatives: t.alternatives.map((a: any) => ({
            id: new Uuid(a.id),
            text: a.text,
            isCorrect: a.isCorrect,
          })),
          imageFile: t.imageFile ?? undefined,
          audioFile: t.audioFile ?? undefined,
        });
        if (!result.ok)
          throw new Error("Erro ao mapear Task de Prisma para domínio");
        return result.value;
      }) ?? [];

    const result = TaskNotebook.create({
      id: new Uuid(prismaNotebook.id),
      educator,
      tasks,
      category: this.mapCategoryFromPrisma(prismaNotebook.category),
      description: prismaNotebook.description,
      createdAt: prismaNotebook.createdAt,
      taskGroupsIds: prismaNotebook.taskGroupsIds,
    });

    if (!result.ok)
      throw new Error("Erro ao mapear TaskNotebook de Prisma para domínio");
    return result.value;
  }

  // ---------- MAPEAMENTOS ENUMS ----------

  private mapCategory(
    category: TaskNotebookCategory
  ): PrismaEnums.TaskNotebookCategory {
    switch (category) {
      case TaskNotebookCategory.Reading:
        return PrismaEnums.TaskNotebookCategory.Reading;
      case TaskNotebookCategory.Writing:
        return PrismaEnums.TaskNotebookCategory.Writing;
      case TaskNotebookCategory.Vocabulary:
        return PrismaEnums.TaskNotebookCategory.Vocabulary;
      case TaskNotebookCategory.Comprehension:
        return PrismaEnums.TaskNotebookCategory.Comprehension;
    }
  }

  private mapCategoryFromPrisma(
    category: PrismaEnums.TaskNotebookCategory
  ): TaskNotebookCategory {
    switch (category) {
      case PrismaEnums.TaskNotebookCategory.Reading:
        return TaskNotebookCategory.Reading;
      case PrismaEnums.TaskNotebookCategory.Writing:
        return TaskNotebookCategory.Writing;
      case PrismaEnums.TaskNotebookCategory.Vocabulary:
        return TaskNotebookCategory.Vocabulary;
      case PrismaEnums.TaskNotebookCategory.Comprehension:
        return TaskNotebookCategory.Comprehension;
    }
  }

  private mapTaskCategory(category: TaskCategory): PrismaEnums.TaskCategory {
    switch (category) {
      case TaskCategory.Reading:
        return PrismaEnums.TaskCategory.Reading;
      case TaskCategory.Writing:
        return PrismaEnums.TaskCategory.Writing;
      case TaskCategory.Vocabulary:
        return PrismaEnums.TaskCategory.Vocabulary;
      case TaskCategory.Comprehension:
        return PrismaEnums.TaskCategory.Comprehension;
    }
  }

  private mapTaskCategoryFromPrisma(
    category: PrismaEnums.TaskCategory
  ): TaskCategory {
    switch (category) {
      case PrismaEnums.TaskCategory.Reading:
        return TaskCategory.Reading;
      case PrismaEnums.TaskCategory.Writing:
        return TaskCategory.Writing;
      case PrismaEnums.TaskCategory.Vocabulary:
        return TaskCategory.Vocabulary;
      case PrismaEnums.TaskCategory.Comprehension:
        return TaskCategory.Comprehension;
    }
  }

  private mapTaskType(type: TaskType): PrismaEnums.TaskType {
    switch (type) {
      case TaskType.MultipleChoice:
        return PrismaEnums.TaskType.MultipleChoice;
      case TaskType.MultipleChoiceWithMedia:
        return PrismaEnums.TaskType.MultipleChoiceWithMedia;
    }
  }

  private mapTaskTypeFromPrisma(type: PrismaEnums.TaskType): TaskType {
    switch (type) {
      case PrismaEnums.TaskType.MultipleChoice:
        return TaskType.MultipleChoice;
      case PrismaEnums.TaskType.MultipleChoiceWithMedia:
        return TaskType.MultipleChoiceWithMedia;
    }
  }
}
