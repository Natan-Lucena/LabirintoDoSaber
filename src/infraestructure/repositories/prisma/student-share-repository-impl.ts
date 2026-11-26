import { Prisma, PrismaClient, StudentShare as PrismaStudentShare } from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import { StudentShare } from "../../../domain/entities/student-share";
import { StudentShareRepository } from "../../../domain/repositories/student-share-repository";

export class StudentShareRepositoryImpl implements StudentShareRepository {
  constructor(private prismaService: PrismaClient) {}

  async create(share: StudentShare): Promise<void> {
    try {
      await this.prismaService.studentShare.create({
        data: {
          id: share.id.value,
          studentId: share.studentId.value,
          educatorId: share.educatorId.value,
          sharedBy: share.sharedBy.value,
          sharedAt: share.sharedAt,
        },
      });
    } catch (error) {
      // P2002: o par (studentId, educatorId) já existe; repetir é idempotente.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return;
      }
      throw error;
    }
  }

  async find(studentId: Uuid, educatorId: Uuid): Promise<StudentShare | null> {
    const record = await this.prismaService.studentShare.findUnique({
      where: {
        studentId_educatorId: { studentId: studentId.value, educatorId: educatorId.value },
      },
    });
    return record ? this.mapToEntity(record) : null;
  }

  async listByStudentId(studentId: Uuid): Promise<StudentShare[]> {
    const records = await this.prismaService.studentShare.findMany({
      where: { studentId: studentId.value },
      orderBy: { sharedAt: "asc" },
    });
    return records.map((record) => this.mapToEntity(record));
  }

  async listByEducatorId(educatorId: Uuid): Promise<StudentShare[]> {
    const records = await this.prismaService.studentShare.findMany({
      where: { educatorId: educatorId.value },
    });
    return records.map((record) => this.mapToEntity(record));
  }

  async listByStudentIds(studentIds: Uuid[]): Promise<StudentShare[]> {
    if (studentIds.length === 0) return [];
    const records = await this.prismaService.studentShare.findMany({
      where: { studentId: { in: studentIds.map((id) => id.value) } },
    });
    return records.map((record) => this.mapToEntity(record));
  }

  async listByStudentIdsAndEducator(
    studentIds: Uuid[],
    educatorId: Uuid
  ): Promise<StudentShare[]> {
    if (studentIds.length === 0) return [];
    const records = await this.prismaService.studentShare.findMany({
      where: {
        educatorId: educatorId.value,
        studentId: { in: studentIds.map((id) => id.value) },
      },
    });
    return records.map((record) => this.mapToEntity(record));
  }

  async delete(studentId: Uuid, educatorId: Uuid): Promise<void> {
    await this.prismaService.studentShare.deleteMany({
      where: { studentId: studentId.value, educatorId: educatorId.value },
    });
  }

  async deleteForEducatorDeparture(educatorId: Uuid, ownedStudentIds: Uuid[]): Promise<number> {
    const { count } = await this.prismaService.studentShare.deleteMany({
      where: {
        OR: [
          { educatorId: educatorId.value },
          ...(ownedStudentIds.length > 0
            ? [{ studentId: { in: ownedStudentIds.map((id) => id.value) } }]
            : []),
        ],
      },
    });
    return count;
  }

  private mapToEntity(record: PrismaStudentShare): StudentShare {
    return StudentShare.fromPersistence({
      id: new Uuid(record.id),
      studentId: new Uuid(record.studentId),
      educatorId: new Uuid(record.educatorId),
      sharedBy: new Uuid(record.sharedBy),
      sharedAt: record.sharedAt,
    });
  }
}
