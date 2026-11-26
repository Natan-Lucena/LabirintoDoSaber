import {
  ActivityResult as PrismaActivityResult,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import { ActivityResult } from "../../../domain/entities/activity-result";
import { TaskType } from "../../../domain/entities/task";
import {
  ActivityResultAlreadyExistsError,
  ActivityResultRepository,
} from "../../../domain/repositories/activity-result-repository";

export class ActivityResultRepositoryImpl implements ActivityResultRepository {
  constructor(private prismaService: PrismaClient) {}

  async save(result: ActivityResult): Promise<void> {
    const data = {
      sessionId: result.sessionId.value,
      taskId: result.taskId.value,
      taskType: result.taskType,
      completed: result.completed,
      correct: result.correct,
      attempts: result.attempts,
      errors: result.errors,
      durationMs: result.durationMs,
      recordedAt: result.recordedAt,
    };

    try {
      await this.prismaService.activityResult.upsert({
        where: { id: result.id.value },
        update: data,
        create: { id: result.id.value, ...data },
      });
    } catch (error) {
      // P2002: violação de unicidade; aqui só existe a de sessionId + taskId.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ActivityResultAlreadyExistsError();
      }
      throw error;
    }
  }

  async findBySessionAndTask(sessionId: Uuid, taskId: Uuid): Promise<ActivityResult | null> {
    const record = await this.prismaService.activityResult.findUnique({
      where: { sessionId_taskId: { sessionId: sessionId.value, taskId: taskId.value } },
    });
    return record ? this.mapToEntity(record) : null;
  }

  async listBySessionId(sessionId: Uuid): Promise<ActivityResult[]> {
    return this.listBySessionIds([sessionId]);
  }

  async listBySessionIds(sessionIds: Uuid[]): Promise<ActivityResult[]> {
    if (sessionIds.length === 0) return [];

    const records = await this.prismaService.activityResult.findMany({
      where: { sessionId: { in: sessionIds.map((id) => id.value) } },
      orderBy: { recordedAt: "asc" },
    });

    return records.map((record) => this.mapToEntity(record));
  }

  private mapToEntity(record: PrismaActivityResult): ActivityResult {
    return ActivityResult.fromPersistence({
      id: new Uuid(record.id),
      sessionId: new Uuid(record.sessionId),
      taskId: new Uuid(record.taskId),
      taskType: record.taskType as TaskType,
      completed: record.completed,
      correct: record.correct,
      attempts: record.attempts,
      errors: record.errors,
      durationMs: record.durationMs,
      recordedAt: record.recordedAt,
    });
  }
}
