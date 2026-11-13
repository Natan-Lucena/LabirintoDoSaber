import {
  Prisma,
  PrismaClient,
  Notification as PrismaNotification,
} from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import {
  Notification,
  NotificationKind,
  NotificationTargetType,
} from "../../../domain/entities/notification";
import {
  ListNotificationsParams,
  NotificationRepository,
  UnreadCountByStudent,
} from "../../../domain/repositories/notification-repository";

export class NotificationRepositoryImpl implements NotificationRepository {
  constructor(private prismaService: PrismaClient) {}

  // O índice único em dedupeKey garante que não há duplicata. As que já
  // existem são filtradas antes porque o createMany do MongoDB não tem
  // skipDuplicates. Se outro cron gravou alguma entre a busca e a inserção
  // (P2002, que interrompe o lote no meio), refaz o ciclo uma vez para gravar
  // as que faltaram.
  async createMany(notifications: Notification[]): Promise<number> {
    if (notifications.length === 0) return 0;

    try {
      return await this.createMissing(notifications);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return this.createMissing(notifications);
      }
      throw error;
    }
  }

  private async createMissing(notifications: Notification[]): Promise<number> {
    const existing = await this.prismaService.notification.findMany({
      where: { dedupeKey: { in: notifications.map((n) => n.dedupeKey) } },
      select: { dedupeKey: true },
    });
    const known = new Set(existing.map((record) => record.dedupeKey));
    const fresh = notifications.filter((n) => !known.has(n.dedupeKey));
    if (fresh.length === 0) return 0;

    const result = await this.prismaService.notification.createMany({
      data: fresh.map((n) => ({ id: n.id.value, ...this.toData(n) })),
    });
    return result.count;
  }

  async deleteCreatedBefore(date: Date): Promise<number> {
    const result = await this.prismaService.notification.deleteMany({
      where: { createdAt: { lt: date } },
    });
    return result.count;
  }

  async save(notification: Notification): Promise<void> {
    const data = this.toData(notification);
    await this.prismaService.notification.upsert({
      where: { id: notification.id.value },
      update: data,
      create: { id: notification.id.value, ...data },
    });
  }

  async findById(id: Uuid): Promise<Notification | null> {
    const record = await this.prismaService.notification.findUnique({
      where: { id: id.value },
    });
    return record ? this.mapToEntity(record) : null;
  }

  async list(params: ListNotificationsParams): Promise<Notification[]> {
    const where: Prisma.NotificationWhereInput = {
      educatorId: params.educatorId.value,
    };
    if (params.unreadOnly) where.readAt = null;
    if (params.after) {
      where.OR = [
        { createdAt: { lt: params.after.createdAt } },
        { createdAt: params.after.createdAt, id: { lt: params.after.id } },
      ];
    }

    const records = await this.prismaService.notification.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: params.limit,
    });
    return records.map((record) => this.mapToEntity(record));
  }

  async countUnreadByStudent(educatorId: Uuid): Promise<UnreadCountByStudent[]> {
    const groups = await this.prismaService.notification.groupBy({
      by: ["studentId"],
      where: { educatorId: educatorId.value, readAt: null },
      _count: { _all: true },
    });
    return groups.map((group) => ({
      studentId: group.studentId ? new Uuid(group.studentId) : undefined,
      count: group._count._all,
    }));
  }

  async markAllRead(educatorId: Uuid, readAt: Date): Promise<number> {
    const result = await this.prismaService.notification.updateMany({
      where: { educatorId: educatorId.value, readAt: null },
      data: { readAt },
    });
    return result.count;
  }

  private toData(notification: Notification) {
    return {
      educatorId: notification.educatorId.value,
      kind: notification.kind,
      title: notification.title,
      body: notification.body,
      targetType: notification.target?.type ?? null,
      targetId: notification.target?.id ?? null,
      studentId: notification.studentId?.value ?? null,
      dedupeKey: notification.dedupeKey,
      createdAt: notification.createdAt,
      readAt: notification.readAt ?? null,
    };
  }

  private mapToEntity(record: PrismaNotification): Notification {
    return Notification.fromPersistence({
      id: new Uuid(record.id),
      educatorId: new Uuid(record.educatorId),
      kind: record.kind as NotificationKind,
      title: record.title,
      body: record.body,
      target:
        record.targetType && record.targetId
          ? { type: record.targetType as NotificationTargetType, id: record.targetId }
          : undefined,
      studentId: record.studentId ? new Uuid(record.studentId) : undefined,
      dedupeKey: record.dedupeKey,
      createdAt: record.createdAt,
      readAt: record.readAt ?? undefined,
    });
  }
}
