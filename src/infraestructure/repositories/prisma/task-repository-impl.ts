import {
  Prisma,
  PrismaClient,
  Task as PrismaTask,
  $Enums as PrismaEnums,
} from "@prisma/client";
import { TaskRepository } from "../../../domain/repositories/task-repository";
import { Uuid } from "@wave-telecom/framework/core";
import {
  Task,
  TaskCategory,
  TaskContent,
  TaskSource,
  TaskTone,
  TaskType,
  toneForId,
} from "../../../domain/entities/task";

const CATEGORY_TO_PRISMA: Record<TaskCategory, PrismaEnums.TaskCategory> = {
  [TaskCategory.Reading]: PrismaEnums.TaskCategory.Reading,
  [TaskCategory.Writing]: PrismaEnums.TaskCategory.Writing,
  [TaskCategory.Vocabulary]: PrismaEnums.TaskCategory.Vocabulary,
  [TaskCategory.Comprehension]: PrismaEnums.TaskCategory.Comprehension,
};

const TYPE_TO_PRISMA: Record<TaskType, PrismaEnums.TaskType> = {
  [TaskType.MultipleChoice]: PrismaEnums.TaskType.MultipleChoice,
  [TaskType.MultipleChoiceWithMedia]: PrismaEnums.TaskType.MultipleChoiceWithMedia,
  [TaskType.WordBuilder]: PrismaEnums.TaskType.WordBuilder,
  [TaskType.ColorMatch]: PrismaEnums.TaskType.ColorMatch,
  [TaskType.MemoryGame]: PrismaEnums.TaskType.MemoryGame,
  [TaskType.Printable]: PrismaEnums.TaskType.Printable,
};

const invert = <K extends string, V extends string>(record: Record<K, V>) =>
  Object.fromEntries(Object.entries(record).map(([key, value]) => [value, key])) as Record<V, K>;

const CATEGORY_FROM_PRISMA = invert(CATEGORY_TO_PRISMA);
const TYPE_FROM_PRISMA = invert(TYPE_TO_PRISMA);

export const mapTaskCategoryToPrisma = (category: TaskCategory) => CATEGORY_TO_PRISMA[category];

// Tarefas antigas não têm os campos do banco de atividades: source ausente =
// EDUCATOR, skills = [] e tone escolhido pelo id.
export function mapPrismaTaskToEntity(prismaTask: PrismaTask): Task {
  const id = new Uuid(prismaTask.id);
  return Task.fromPersistence({
    id,
    createdAt: prismaTask.createdAt,
    category: CATEGORY_FROM_PRISMA[prismaTask.category],
    type: TYPE_FROM_PRISMA[prismaTask.type],
    prompt: prismaTask.prompt,
    alternatives: prismaTask.alternatives.map((alt) => ({
      id: new Uuid(alt.id),
      text: alt.text,
      isCorrect: alt.isCorrect,
    })),
    imageFile: prismaTask.imageFile ?? undefined,
    audioFile: prismaTask.audioFile ?? undefined,
    source: (prismaTask.source as TaskSource | null) ?? TaskSource.Educator,
    educatorId: prismaTask.educatorId ? new Uuid(prismaTask.educatorId) : undefined,
    skills: prismaTask.skills ?? [],
    theme: prismaTask.theme ?? undefined,
    tone: (prismaTask.tone as TaskTone | null) ?? toneForId(id),
    content: (prismaTask.content as unknown as TaskContent | null) ?? undefined,
  });
}

function toPrismaData(task: Task) {
  return {
    category: CATEGORY_TO_PRISMA[task.category],
    type: TYPE_TO_PRISMA[task.type],
    prompt: task.prompt,
    alternatives: task.alternatives.map((alt) => ({
      id: alt.id?.value ?? Uuid.random().value,
      text: alt.text,
      isCorrect: alt.isCorrect,
    })),
    imageFile: task.imageFile ?? null,
    audioFile: task.audioFile ?? null,
    source: task.source as PrismaEnums.TaskSource,
    educatorId: task.educatorId?.value ?? null,
    skills: task.skills,
    theme: task.theme ?? null,
    tone: task.tone as PrismaEnums.TaskTone,
    // Json opcional: o tipo não muda, então content nunca precisa ser apagado.
    content: task.content as unknown as Prisma.InputJsonValue | undefined,
  };
}

export class TaskRepositoryImpl implements TaskRepository {
  constructor(private prismaService: PrismaClient) {}

  async save(task: Task): Promise<void> {
    const data = toPrismaData(task);
    await this.prismaService.task.upsert({
      where: { id: task.id.value },
      update: data,
      create: { id: task.id.value, createdAt: task.createdAt, ...data },
    });
  }

  async saveMany(tasks: Task[]): Promise<void> {
    if (tasks.length === 0) return;

    await this.prismaService.task.createMany({
      data: tasks.map((task) => ({
        id: task.id.value,
        createdAt: task.createdAt,
        ...toPrismaData(task),
      })),
    });
  }

  async getById(id: Uuid): Promise<Task | null> {
    const prismaTask = await this.prismaService.task.findUnique({
      where: { id: id.value },
    });

    if (!prismaTask) return null;

    return mapPrismaTaskToEntity(prismaTask);
  }

  async getByIds(ids: Uuid[]): Promise<Task[]> {
    if (ids.length === 0) return [];

    const uniqueIds = Array.from(new Set(ids.map((id) => id.value)));

    const prismaTasks = await this.prismaService.task.findMany({
      where: { id: { in: uniqueIds } },
    });

    return prismaTasks.map(mapPrismaTaskToEntity);
  }

  async listByEducator(educatorId: Uuid): Promise<Task[]> {
    const [notebooks, groups] = await Promise.all([
      this.prismaService.taskNotebook.findMany({
        where: { educatorId: educatorId.value },
        select: { id: true, taskIds: true },
      }),
      this.prismaService.taskGroup.findMany({
        where: { educatorId: educatorId.value },
        select: { taskIds: true },
      }),
    ]);

    const legacyIds = Array.from(
      new Set([
        ...notebooks.flatMap((notebook) => notebook.taskIds ?? []),
        ...groups.flatMap((group) => group.taskIds),
      ])
    );

    const prismaTasks = await this.prismaService.task.findMany({
      where: {
        OR: [
          { educatorId: educatorId.value },
          {
            AND: [
              { OR: [{ educatorId: null }, { educatorId: { isSet: false } }] },
              {
                OR: [
                  { id: { in: legacyIds } },
                  { notebookId: { in: notebooks.map((notebook) => notebook.id) } },
                ],
              },
            ],
          },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    // Tarefas da biblioteca nos cadernos e grupos não são do educador.
    return prismaTasks
      .map(mapPrismaTaskToEntity)
      .filter((task) => task.source === TaskSource.Educator);
  }

  async listLibrary(): Promise<Task[]> {
    const prismaTasks = await this.prismaService.task.findMany({
      where: { source: PrismaEnums.TaskSource.LIBRARY },
      orderBy: { createdAt: "desc" },
    });
    return prismaTasks.map(mapPrismaTaskToEntity);
  }

  async delete(id: Uuid): Promise<void> {
    await this.prismaService.task.delete({
      where: { id: id.value },
    });
  }
}
