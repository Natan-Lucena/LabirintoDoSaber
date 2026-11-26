import { PrismaClient, AppointmentSeries as PrismaAppointmentSeries } from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import {
  AppointmentSeries,
  RecurrenceFrequency,
} from "../../../domain/entities/appointment-series";
import { AppointmentSeriesRepository } from "../../../domain/repositories/appointment-series-repository";

export class AppointmentSeriesRepositoryImpl implements AppointmentSeriesRepository {
  constructor(private prismaService: PrismaClient) {}

  async save(series: AppointmentSeries): Promise<void> {
    const data = {
      studentId: series.studentId.value,
      educatorId: series.educatorId.value,
      frequency: series.frequency,
      firstScheduledAt: series.firstScheduledAt,
      occurrences: series.occurrences,
      type: series.type ?? null,
      durationMinutes: series.durationMinutes,
      observation: series.observation ?? null,
      endedAt: series.endedAt ?? null,
    };

    await this.prismaService.appointmentSeries.upsert({
      where: { id: series.id.value },
      update: data,
      create: { id: series.id.value, ...data, createdAt: series.createdAt },
    });
  }

  async findById(id: Uuid): Promise<AppointmentSeries | null> {
    const record = await this.prismaService.appointmentSeries.findUnique({
      where: { id: id.value },
    });
    return record ? this.mapToEntity(record) : null;
  }

  private mapToEntity(record: PrismaAppointmentSeries): AppointmentSeries {
    return AppointmentSeries.fromPersistence({
      id: new Uuid(record.id),
      studentId: new Uuid(record.studentId),
      educatorId: new Uuid(record.educatorId),
      frequency: RecurrenceFrequency[record.frequency],
      firstScheduledAt: record.firstScheduledAt,
      occurrences: record.occurrences,
      type: record.type ?? undefined,
      durationMinutes: record.durationMinutes,
      observation: record.observation ?? undefined,
      endedAt: record.endedAt ?? undefined,
      createdAt: record.createdAt,
    });
  }
}
