import {
  Prisma,
  PrismaClient,
  Task as PrismaTask,
  $Enums as PrismaEnums,
} from "@prisma/client";
import {
  SearchTaskProps,
  TaskRepository,
} from "../../../domain/repositories/task-repository";
import { Uuid } from "@wave-telecom/framework/core";
import { Task, TaskCategory, TaskType } from "../../../domain/entities/task";

export class TaskRepositoryImpl implements TaskRepository {
  constructor(private prismaService: PrismaClient) {}

  async save(task: Task): Promise<void> {
    await this.prismaService.task.upsert({
      where: { id: task.id.value },
      update: {
        category: this.mapCategory(task.category),
        type: this.mapType(task.type),
        prompt: task.prompt,
        alternatives: task.alternatives.map((alt) => ({
          id: alt.id?.value ?? Uuid.random().value,
          text: alt.text,
          isCorrect: alt.isCorrect,
        })),
        imageFile: task.imageFile,
        audioFile: task.audioFile,
      },
      create: {
        id: task.id.value,
        category: this.mapCategory(task.category),
        type: this.mapType(task.type),
        prompt: task.prompt,
        alternatives: task.alternatives.map((alt) => ({
          id: alt.id?.value ?? Uuid.random().value,
          text: alt.text,
          isCorrect: alt.isCorrect,
        })),
        imageFile: task.imageFile,
        audioFile: task.audioFile,
        createdAt: task.createdAt,
      },
    });
  }

  async saveMany(tasks: Task[]): Promise<void> {
    if (tasks.length === 0) return;

    await this.prismaService.task.createMany({
      data: tasks.map((task) => ({
        id: task.id.value,
        category: this.mapCategory(task.category),
        type: this.mapType(task.type),
        prompt: task.prompt,
        alternatives: task.alternatives.map((alt) => ({
          id: alt.id?.value ?? Uuid.random().value,
          text: alt.text,
          isCorrect: alt.isCorrect,
        })),
        imageFile: task.imageFile,
        audioFile: task.audioFile,
        createdAt: task.createdAt,
      })),
    });
  }

  async getById(id: Uuid): Promise<Task | null> {
    const prismaTask = await this.prismaService.task.findUnique({
      where: { id: id.value },
    });

    if (!prismaTask) return null;

    return this.mapToEntity(prismaTask);
  }

  async getByIds(ids: Uuid[]): Promise<Task[]> {
    if (ids.length === 0) return [];

    const uniqueIds = Array.from(new Set(ids.map((id) => id.value)));

    const prismaTasks = await this.prismaService.task.findMany({
      where: { id: { in: uniqueIds } },
    });

    return prismaTasks.map((task) => this.mapToEntity(task));
  }

  async search(params: SearchTaskProps): Promise<Task[]> {
    const prismaTasks = await this.prismaService.task.findMany({
      where: {
        id: params.id ? params.id.value : undefined,
        prompt: params.promptContains
          ? {
              contains: params.promptContains,
            }
          : undefined,
        category: params.category
          ? this.mapCategory(params.category)
          : undefined,
        type: params.type ? this.mapType(params.type) : undefined,
      },
    });

    return prismaTasks.map((task) => this.mapToEntity(task));
  }

  async delete(id: Uuid): Promise<void> {
    await this.prismaService.task.delete({
      where: { id: id.value },
    });
  }

  private mapToEntity(prismaTask: PrismaTask): Task {
    const result = Task.create({
      id: new Uuid(prismaTask.id),
      createdAt: prismaTask.createdAt,
      category: this.mapCategoryFromPrisma(prismaTask.category),
      type: this.mapTypeFromPrisma(prismaTask.type),
      prompt: prismaTask.prompt,
      alternatives: prismaTask.alternatives.map((alt) => ({
        id: new Uuid(alt.id),
        text: alt.text,
        isCorrect: alt.isCorrect,
      })),
      imageFile: prismaTask.imageFile ?? undefined,
      audioFile: prismaTask.audioFile ?? undefined,
    });

    if (!result.ok) {
      throw new Error("Falha ao converter PrismaTask para Task (entidade)");
    }

    return result.value;
  }

  private mapCategory(category: TaskCategory): PrismaEnums.TaskCategory {
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

  private mapType(type: TaskType): PrismaEnums.TaskType {
    switch (type) {
      case TaskType.MultipleChoice:
        return PrismaEnums.TaskType.MultipleChoice;
      case TaskType.MultipleChoiceWithMedia:
        return PrismaEnums.TaskType.MultipleChoiceWithMedia;
    }
  }

  private mapCategoryFromPrisma(
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

  private mapTypeFromPrisma(type: PrismaEnums.TaskType): TaskType {
    switch (type) {
      case PrismaEnums.TaskType.MultipleChoice:
        return TaskType.MultipleChoice;
      case PrismaEnums.TaskType.MultipleChoiceWithMedia:
        return TaskType.MultipleChoiceWithMedia;
    }
  }
}
