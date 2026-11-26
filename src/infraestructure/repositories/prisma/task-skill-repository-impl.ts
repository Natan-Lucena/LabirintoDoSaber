import { PrismaClient } from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import { TaskSkill } from "../../../domain/entities/task-skill";
import { TaskSkillRepository } from "../../../domain/repositories/task-skill-repository";

export class TaskSkillRepositoryImpl implements TaskSkillRepository {
  constructor(private prismaService: PrismaClient) {}

  async listAll(): Promise<TaskSkill[]> {
    const records = await this.prismaService.taskSkill.findMany({
      orderBy: { order: "asc" },
    });
    return records.map((record) =>
      TaskSkill.fromPersistence({
        id: new Uuid(record.id),
        code: record.code,
        label: record.label,
        learningTopics: record.learningTopics,
        order: record.order,
      })
    );
  }

  async save(skill: TaskSkill): Promise<void> {
    const data = {
      code: skill.code,
      label: skill.label,
      learningTopics: skill.learningTopics,
      order: skill.order,
    };
    await this.prismaService.taskSkill.upsert({
      where: { id: skill.id.value },
      update: data,
      create: { id: skill.id.value, ...data },
    });
  }
}
