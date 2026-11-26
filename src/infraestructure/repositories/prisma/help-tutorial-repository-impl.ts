import { HelpTutorial as PrismaHelpTutorial, PrismaClient } from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import { HelpTutorial } from "../../../domain/entities/help-tutorial";
import { HelpTutorialRepository } from "../../../domain/repositories/help-tutorial-repository";

export class HelpTutorialRepositoryImpl implements HelpTutorialRepository {
  constructor(private prismaService: PrismaClient) {}

  async listAll(): Promise<HelpTutorial[]> {
    const records = await this.prismaService.helpTutorial.findMany({
      orderBy: { order: "asc" },
    });
    return records.map((record) => this.mapToEntity(record));
  }

  async save(tutorial: HelpTutorial): Promise<void> {
    const data = {
      order: tutorial.order,
      title: tutorial.title,
      description: tutorial.description,
      durationSeconds: tutorial.durationSeconds,
      featured: tutorial.featured,
      videoUrl: tutorial.videoUrl ?? null,
      thumbnailUrl: tutorial.thumbnailUrl ?? null,
      steps: tutorial.steps ?? [],
    };
    await this.prismaService.helpTutorial.upsert({
      where: { id: tutorial.id.value },
      update: { ...data, steps: { set: data.steps } },
      create: { id: tutorial.id.value, ...data },
    });
  }

  async deleteByIds(ids: Uuid[]): Promise<void> {
    if (ids.length === 0) return;
    await this.prismaService.helpTutorial.deleteMany({
      where: { id: { in: ids.map((id) => id.value) } },
    });
  }

  private mapToEntity(record: PrismaHelpTutorial): HelpTutorial {
    return HelpTutorial.fromPersistence({
      id: new Uuid(record.id),
      order: record.order,
      title: record.title,
      description: record.description,
      durationSeconds: record.durationSeconds,
      featured: record.featured,
      videoUrl: record.videoUrl ?? undefined,
      thumbnailUrl: record.thumbnailUrl ?? undefined,
      steps: record.steps.length > 0 ? record.steps : undefined,
    });
  }
}
