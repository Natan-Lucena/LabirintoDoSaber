import {
  PrismaClient,
  TaskNotebookSession as prismaTaskNotebookSession,
} from "@prisma/client";
import {
  FinishedSessionRef,
  ListByEducatorIdParams,
  ListFinishedBetweenParams,
  ListFinishedByEducatorSinceParams,
  TaskNotebookSessionRepository,
} from "../../../domain/repositories/task-notebook-session-repository";
import { Uuid } from "@wave-telecom/framework/core";
import { TaskNotebookSession } from "../../../domain/entities/task-notebook-session";

export class TaskNotebokSessionRepositoryImpl
  implements TaskNotebookSessionRepository
{
  constructor(private prismaService: PrismaClient) {}

  async listByEducatorId(
    params: ListByEducatorIdParams
  ): Promise<TaskNotebookSession[]> {
    const result = await this.prismaService.taskNotebookSession.findMany({
      where: { educatorId: params.educatorId.value },
      take: params.limit,
    });
    return result.map((data) => this.mapToEntity(data));
  }
  async listFinishedByEducatorSince(
    params: ListFinishedByEducatorSinceParams
  ): Promise<TaskNotebookSession[]> {
    const result = await this.prismaService.taskNotebookSession.findMany({
      where: {
        educatorId: params.educatorId.value,
        finishedAt: { gte: params.since },
      },
      orderBy: { finishedAt: "desc" },
    });
    return result.map((data) => this.mapToEntity(data));
  }

  async listFinishedBetween(
    params: ListFinishedBetweenParams
  ): Promise<FinishedSessionRef[]> {
    const result = await this.prismaService.taskNotebookSession.findMany({
      where: { finishedAt: { gte: params.from, lte: params.to } },
      select: { id: true, studentId: true, educatorId: true, finishedAt: true },
      orderBy: [{ finishedAt: "asc" }, { id: "asc" }],
    });
    return result.map((data) => ({
      id: new Uuid(data.id),
      studentId: new Uuid(data.studentId),
      educatorId: new Uuid(data.educatorId),
      // O filtro garante finishedAt preenchido.
      finishedAt: data.finishedAt!,
    }));
  }

  async save(session: TaskNotebookSession): Promise<void> {
    await this.prismaService.taskNotebookSession.upsert({
      where: { id: session.id.value },
      create: {
        id: session.id.value,
        name: session.name,
        educatorId: session.educatorId.value,
        startedAt: session.startedAt,
        studentId: session.studentId.value,
        finishedAt: session.finishedAt,
        observation: session.observation,
        taskNotebookId: session.taskNotebookId?.value ?? null,
        appointmentId: session.appointmentId?.value ?? null,
      },
      update: {
        startedAt: session.startedAt,
        finishedAt: session.finishedAt,
        observation: session.observation,
        taskNotebookId: session.taskNotebookId?.value ?? null,
        appointmentId: session.appointmentId?.value ?? null,
        answers: {
          set: session.answers.map((a) => ({
            taskId: a.taskId.value,
            selectedAlternativeId: a.selectedAlternativeId.value,
            isCorrect: a.isCorrect,
            timeToAnswer: a.timeToAnswer,
            answeredAt: a.answeredAt,
          })),
        },
      },
    });
  }

  async getById(id: Uuid): Promise<TaskNotebookSession | null> {
    const result = await this.prismaService.taskNotebookSession.findUnique({
      where: { id: id.value },
    });
    return result ? this.mapToEntity(result) : null;
  }

  async listByStudentId(studentId: Uuid): Promise<TaskNotebookSession[]> {
    const results = await this.prismaService.taskNotebookSession.findMany({
      where: { studentId: studentId.value },
    });
    return results.map((data) => this.mapToEntity(data));
  }

  private mapToEntity(data: prismaTaskNotebookSession): TaskNotebookSession {
    return new TaskNotebookSession(
      new Uuid(data.id),
      new Uuid(data.studentId),
      new Uuid(data.educatorId),
      data.name,
      data.startedAt,
      data.finishedAt ?? undefined,
      data.answers.map((a) => ({
        taskId: new Uuid(a.taskId),
        selectedAlternativeId: new Uuid(a.selectedAlternativeId),
        isCorrect: a.isCorrect,
        timeToAnswer: a.timeToAnswer,
        answeredAt: a.answeredAt,
      })),
      data.observation ?? undefined,
      data.taskNotebookId ? new Uuid(data.taskNotebookId) : undefined,
      data.appointmentId ? new Uuid(data.appointmentId) : undefined
    );
  }
}
