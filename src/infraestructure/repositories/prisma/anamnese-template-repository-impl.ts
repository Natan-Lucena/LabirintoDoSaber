import {
  PrismaClient,
  AnamneseTemplate as PrismaAnamneseTemplate,
  $Enums as PrismaEnums,
} from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import { AnamneseTemplateRepository } from "../../../domain/repositories/anamnese-template-repository";
import {
  AnamneseTemplate,
  AnamneseQuestion,
  AnamneseQuestionType,
} from "../../../domain/entities/anamnese-template";

export class AnamneseTemplateRepositoryImpl implements AnamneseTemplateRepository {
  constructor(private prismaService: PrismaClient) {}

  async save(template: AnamneseTemplate): Promise<void> {
    const questions = template.questions.map((q) => ({
      id: q.id,
      text: q.text,
      type: this.mapTypeToPrisma(q.type),
      required: q.required,
      order: q.order,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
    }));

    await this.prismaService.anamneseTemplate.upsert({
      where: { id: template.id.value },
      create: {
        id: template.id.value,
        educatorId: template.educatorId.value,
        title: template.title,
        description: template.description,
        questions,
        createdAt: template.createdAt,
      },
      update: {
        title: template.title,
        description: template.description,
        questions,
      },
    });
  }

  async findById(id: Uuid): Promise<AnamneseTemplate | null> {
    const result = await this.prismaService.anamneseTemplate.findUnique({
      where: { id: id.value },
    });
    return result ? this.mapToEntity(result) : null;
  }

  async listByEducatorId(educatorId: Uuid): Promise<AnamneseTemplate[]> {
    const results = await this.prismaService.anamneseTemplate.findMany({
      where: { educatorId: educatorId.value },
      orderBy: { createdAt: "desc" },
    });
    return results.map((r) => this.mapToEntity(r));
  }

  async deleteById(id: Uuid): Promise<void> {
    await this.prismaService.anamneseTemplate.delete({
      where: { id: id.value },
    });
  }

  private mapToEntity(data: PrismaAnamneseTemplate): AnamneseTemplate {
    const questions: AnamneseQuestion[] = data.questions.map((q) => ({
      id: q.id,
      text: q.text,
      type: this.mapTypeFromPrisma(q.type),
      required: q.required,
      order: q.order,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
    }));

    return AnamneseTemplate.fromPersistence({
      id: new Uuid(data.id),
      educatorId: new Uuid(data.educatorId),
      title: data.title,
      description: data.description ?? undefined,
      questions,
      createdAt: data.createdAt,
    });
  }

  private mapTypeToPrisma(type: AnamneseQuestionType): PrismaEnums.AnamneseQuestionType {
    return PrismaEnums.AnamneseQuestionType[type];
  }

  private mapTypeFromPrisma(type: PrismaEnums.AnamneseQuestionType): AnamneseQuestionType {
    return AnamneseQuestionType[type as keyof typeof AnamneseQuestionType];
  }
}
