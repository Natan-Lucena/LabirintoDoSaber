import {
  PrismaClient,
  AnamneseResponse as PrismaAnamneseResponse,
  $Enums as PrismaEnums,
} from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import { AnamneseResponseRepository } from "../../../domain/repositories/anamnese-response-repository";
import { AnamneseResponse, AnamneseAnswer } from "../../../domain/entities/anamnese-response";
import { AnamneseQuestionType } from "../../../domain/entities/anamnese-template";

export class AnamneseResponseRepositoryImpl implements AnamneseResponseRepository {
  constructor(private prismaService: PrismaClient) {}

  async save(response: AnamneseResponse): Promise<void> {
    const answers = response.answers.map((a) => ({
      questionId: a.questionId,
      questionType: this.mapTypeToPrisma(a.questionType),
      textValue: a.textValue ?? null,
      selectedOptionId: a.selectedOptionId ?? null,
      selectedOptionIds: a.selectedOptionIds ?? [],
      fileUrl: a.fileUrl ?? null,
    }));

    await this.prismaService.anamneseResponse.create({
      data: {
        id: response.id.value,
        templateId: response.templateId.value,
        educatorId: response.educatorId.value,
        studentId: response.studentId.value,
        answeredAt: response.answeredAt,
        answers,
      },
    });
  }

  async findById(id: Uuid): Promise<AnamneseResponse | null> {
    const result = await this.prismaService.anamneseResponse.findUnique({
      where: { id: id.value },
    });
    return result ? this.mapToEntity(result) : null;
  }

  async listByStudentId(studentId: Uuid): Promise<AnamneseResponse[]> {
    const results = await this.prismaService.anamneseResponse.findMany({
      where: { studentId: studentId.value },
      orderBy: { answeredAt: "desc" },
    });
    return results.map((r) => this.mapToEntity(r));
  }

  async existsByTemplateId(templateId: Uuid): Promise<boolean> {
    const count = await this.prismaService.anamneseResponse.count({
      where: { templateId: templateId.value },
    });
    return count > 0;
  }

  private mapToEntity(data: PrismaAnamneseResponse): AnamneseResponse {
    const answers: AnamneseAnswer[] = data.answers.map((a) => ({
      questionId: a.questionId,
      questionType: this.mapTypeFromPrisma(a.questionType),
      textValue: a.textValue ?? undefined,
      selectedOptionId: a.selectedOptionId ?? undefined,
      selectedOptionIds: a.selectedOptionIds.length ? a.selectedOptionIds : undefined,
      fileUrl: a.fileUrl ?? undefined,
    }));

    return AnamneseResponse.fromPersistence({
      id: new Uuid(data.id),
      templateId: new Uuid(data.templateId),
      educatorId: new Uuid(data.educatorId),
      studentId: new Uuid(data.studentId),
      answers,
      answeredAt: data.answeredAt,
    });
  }

  private mapTypeToPrisma(type: AnamneseQuestionType): PrismaEnums.AnamneseQuestionType {
    return PrismaEnums.AnamneseQuestionType[type];
  }

  private mapTypeFromPrisma(type: PrismaEnums.AnamneseQuestionType): AnamneseQuestionType {
    return AnamneseQuestionType[type as keyof typeof AnamneseQuestionType];
  }
}
