import {
  PrismaClient,
  NotificationPreferences as PrismaNotificationPreferences,
} from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import { NotificationKind } from "../../../domain/entities/notification";
import { NotificationPreferences } from "../../../domain/entities/notification-preferences";
import { NotificationPreferencesRepository } from "../../../domain/repositories/notification-preferences-repository";

export class NotificationPreferencesRepositoryImpl implements NotificationPreferencesRepository {
  constructor(private prismaService: PrismaClient) {}

  async findByEducatorId(educatorId: Uuid): Promise<NotificationPreferences | null> {
    const record = await this.prismaService.notificationPreferences.findUnique({
      where: { educatorId: educatorId.value },
    });
    return record ? this.mapToEntity(record) : null;
  }

  async listByEducatorIds(educatorIds: Uuid[]): Promise<NotificationPreferences[]> {
    if (educatorIds.length === 0) return [];
    const records = await this.prismaService.notificationPreferences.findMany({
      where: { educatorId: { in: educatorIds.map((id) => id.value) } },
    });
    return records.map((record) => this.mapToEntity(record));
  }

  async save(preferences: NotificationPreferences): Promise<void> {
    const data = {
      educatorId: preferences.educatorId.value,
      pushEnabled: preferences.pushEnabled,
      disabledKinds: preferences.disabledKinds,
      updatedAt: preferences.updatedAt,
    };
    await this.prismaService.notificationPreferences.upsert({
      where: { id: preferences.id.value },
      update: { ...data, disabledKinds: { set: data.disabledKinds } },
      create: { id: preferences.id.value, ...data },
    });
  }

  private mapToEntity(record: PrismaNotificationPreferences): NotificationPreferences {
    return NotificationPreferences.fromPersistence({
      id: new Uuid(record.id),
      educatorId: new Uuid(record.educatorId),
      pushEnabled: record.pushEnabled,
      disabledKinds: record.disabledKinds as NotificationKind[],
      updatedAt: record.updatedAt,
    });
  }
}
