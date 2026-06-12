import { PrismaClient, Prisma, AppointmentStatus as PrismaAppointmentStatus } from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import {
  AppointmentRepository,
  SearchAppointmentParams,
} from "../../../domain/repositories/appointment-repository";
import {
  Appointment,
  AppointmentMetadata,
  AppointmentStatus,
} from "../../../domain/entities/appointment";

export class AppointmentRepositoryImpl implements AppointmentRepository {
  constructor(private prismaService: PrismaClient) {}

  async save(appointment: Appointment): Promise<void> {
    await this.prismaService.appointment.upsert({
      where: { id: appointment.id.value },
      update: {
        educatorId: appointment.educatorId.value,
        studentId: appointment.studentId.value,
        scheduledAt: appointment.scheduledAt,
        observation: appointment.observation ?? null,
        status: this.mapStatus(appointment.status),
        notifiedAt: appointment.notifiedAt ?? null,
        metadata: appointment.metadata as Prisma.InputJsonValue,
      },
      create: {
        id: appointment.id.value,
        educatorId: appointment.educatorId.value,
        studentId: appointment.studentId.value,
        scheduledAt: appointment.scheduledAt,
        observation: appointment.observation ?? null,
        status: this.mapStatus(appointment.status),
        notifiedAt: appointment.notifiedAt ?? null,
        metadata: appointment.metadata as Prisma.InputJsonValue,
        createdAt: appointment.createdAt,
      },
    });
  }

  async findById(id: Uuid): Promise<Appointment | null> {
    const record = await this.prismaService.appointment.findUnique({
      where: { id: id.value },
    });

    if (!record) return null;

    return this.mapToEntity(record);
  }

  async search(params: SearchAppointmentParams): Promise<Appointment[]> {
    const where: Prisma.AppointmentWhereInput = {};

    if (params.educatorId) {
      where.educatorId = params.educatorId.value;
    }

    if (params.studentId) {
      where.studentId = params.studentId.value;
    }

    if (params.status) {
      where.status = this.mapStatus(params.status);
    }

    if (params.scheduledBefore !== undefined || params.scheduledAfter !== undefined) {
      where.scheduledAt = {};
      if (params.scheduledBefore) {
        where.scheduledAt.lte = params.scheduledBefore;
      }
      if (params.scheduledAfter) {
        where.scheduledAt.gte = params.scheduledAfter;
      }
    }

    if (params.notified === true) {
      where.notifiedAt = { not: null };
    } else if (params.notified === false) {
      where.notifiedAt = null;
    }

    // hasScheduledJob filtering is applied in-memory after fetching
    // (MongoDB Prisma JSON path filtering limitations)

    const records = await this.prismaService.appointment.findMany({
      where,
      take: params.hasScheduledJob !== undefined ? undefined : params.limit,
      orderBy: { scheduledAt: "asc" },
    });

    let entities = records.map((r) => this.mapToEntity(r));

    if (params.hasScheduledJob === true) {
      entities = entities.filter(
        (e) => typeof e.metadata["qstashMessageId"] === "string" && e.metadata["qstashMessageId"] !== null
      );
    } else if (params.hasScheduledJob === false) {
      entities = entities.filter(
        (e) => typeof e.metadata["qstashMessageId"] !== "string" || e.metadata["qstashMessageId"] === null
      );
    }

    if (params.hasScheduledJob !== undefined && params.limit !== undefined) {
      entities = entities.slice(0, params.limit);
    }

    return entities;
  }

  async delete(id: Uuid): Promise<void> {
    await this.prismaService.appointment.delete({
      where: { id: id.value },
    });
  }

  private mapToEntity(record: {
    id: string;
    educatorId: string;
    studentId: string;
    scheduledAt: Date;
    observation: string | null;
    status: PrismaAppointmentStatus;
    notifiedAt: Date | null;
    metadata: Prisma.JsonValue;
    createdAt: Date;
  }): Appointment {
    const metadata = (
      record.metadata && typeof record.metadata === "object" && !Array.isArray(record.metadata)
        ? record.metadata
        : {}
    ) as AppointmentMetadata;

    return Appointment.create({
      id: new Uuid(record.id),
      educatorId: new Uuid(record.educatorId),
      studentId: new Uuid(record.studentId),
      scheduledAt: record.scheduledAt,
      observation: record.observation ?? undefined,
      status: this.mapStatusFromPrisma(record.status),
      notifiedAt: record.notifiedAt ?? undefined,
      metadata,
      createdAt: record.createdAt,
    });
  }

  private mapStatus(status: AppointmentStatus): PrismaAppointmentStatus {
    switch (status) {
      case AppointmentStatus.PENDING:
        return PrismaAppointmentStatus.PENDING;
      case AppointmentStatus.COMPLETED:
        return PrismaAppointmentStatus.COMPLETED;
      case AppointmentStatus.CANCELLED:
        return PrismaAppointmentStatus.CANCELLED;
    }
  }

  private mapStatusFromPrisma(status: PrismaAppointmentStatus): AppointmentStatus {
    switch (status) {
      case PrismaAppointmentStatus.PENDING:
        return AppointmentStatus.PENDING;
      case PrismaAppointmentStatus.COMPLETED:
        return AppointmentStatus.COMPLETED;
      case PrismaAppointmentStatus.CANCELLED:
        return AppointmentStatus.CANCELLED;
    }
  }
}
