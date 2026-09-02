import {
  PrismaClient,
  TaskGroup as PrismaTaskGroup,
  $Enums as PrismaEnums,
} from "@prisma/client";
import {
  searchTaskGroupsParams,
  TaskGroupRepository,
} from "../../../domain/repositories/task-group-repository";
import { Uuid } from "@wave-telecom/framework/core";
import { TaskGroup } from "../../../domain/entities/task-group";
import { TaskCategory } from "../../../domain/entities/task";

export class TaskGroupRepositoryImpl implements TaskGroupRepository {
  constructor(private prismaService: PrismaClient) {}

  async save(taskGroup: TaskGroup): Promise<TaskGroup> {
    const result = await this.prismaService.taskGroup.upsert({
      where: { id: taskGroup.id.value },
      update: {
        name: taskGroup.name,
        educatorId: taskGroup.educatorId.value,
        category: this.mapCategory(taskGroup.category),
        taskIds: taskGroup.tasksIds,
      },
      create: {
        id: taskGroup.id.value,
        name: taskGroup.name,
        educatorId: taskGroup.educatorId.value,
        category: this.mapCategory(taskGroup.category),
        taskIds: taskGroup.tasksIds,
      },
    });
    return this.mapToEntity(result);
  }
  async findById(id: Uuid): Promise<TaskGroup | null> {
    const result = await this.prismaService.taskGroup.findFirst({
      where: { id: id.value },
    });
    if (!result) return null;
    return this.mapToEntity(result);
  }
  async findByIds(ids: Uuid[]): Promise<TaskGroup[]> {
    if (ids.length === 0) return [];

    const uniqueIds = Array.from(new Set(ids.map((id) => id.value)));

    const results = await this.prismaService.taskGroup.findMany({
      where: { id: { in: uniqueIds } },
    });

    return results.map((value) => this.mapToEntity(value));
  }
  async search(params: searchTaskGroupsParams): Promise<TaskGroup[]> {
    const result = await this.prismaService.taskGroup.findMany({
      where: {
        category: params.category
          ? this.mapCategory(params.category)
          : undefined,
        name: params.nameContains
          ? { contains: params.nameContains }
          : undefined,
        educatorId: params.educatorId ? params.educatorId.value : undefined,
      },
    });

    return result.map((value) => this.mapToEntity(value));
  }
  async deleteById(id: Uuid): Promise<void> {
    await this.prismaService.taskGroup.delete({
      where: { id: id.value },
    });
  }

  private mapToEntity(prismaTaskGroup: PrismaTaskGroup): TaskGroup {
    return TaskGroup.create({
      id: new Uuid(prismaTaskGroup.id),
      name: prismaTaskGroup.name,
      tasksIds: prismaTaskGroup.taskIds,
      educatorId: new Uuid(prismaTaskGroup.educatorId),
      category: this.mapCategoryFromPrisma(prismaTaskGroup.category),
    });
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
}
