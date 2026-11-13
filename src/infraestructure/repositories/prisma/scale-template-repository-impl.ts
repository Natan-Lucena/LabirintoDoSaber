import { PrismaClient, ScaleTemplate as PrismaScaleTemplate } from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import { ScaleTemplateRepository } from "../../../domain/repositories/scale-template-repository";
import {
  BandSeverity,
  ScaleRespondent,
  ScaleTemplate,
  ScoringMethod,
} from "../../../domain/entities/scale-template";

export class ScaleTemplateRepositoryImpl implements ScaleTemplateRepository {
  constructor(private prismaService: PrismaClient) {}

  async save(template: ScaleTemplate): Promise<void> {
    const data = {
      code: template.code,
      version: template.version,
      name: template.name,
      description: template.description,
      instructions: template.instructions,
      respondent: template.respondent,
      ageRange: template.ageRange
        ? { min: template.ageRange.min, max: template.ageRange.max }
        : null,
      estimatedMinutes: template.estimatedMinutes,
      disclaimer: template.disclaimer,
      reference: template.reference,
      active: template.active,
    };

    const options = template.options.map((option) => ({
      value: option.value,
      label: option.label,
    }));
    // Na ordem do arquivo publicado, para o seed comparar o conteúdo.
    const items = template.definition.items.map((item) => ({
      id: item.id,
      order: item.order,
      text: item.text,
      subscaleCode: item.subscaleCode ?? null,
    }));
    const subscales = template.subscales.map((subscale) => ({
      code: subscale.code,
      name: subscale.name,
    }));
    const scoring = {
      method: template.scoring.method,
      bands: template.scoring.bands.map((band) => ({
        subscaleCode: band.subscaleCode ?? null,
        min: band.min,
        max: band.max,
        label: band.label,
        severity: band.severity,
      })),
    };

    await this.prismaService.scaleTemplate.upsert({
      where: { id: template.id.value },
      update: {
        ...data,
        options: { set: options },
        items: { set: items },
        subscales: { set: subscales },
        scoring: { set: scoring },
      },
      create: { id: template.id.value, ...data, options, items, subscales, scoring },
    });
  }

  async findById(id: Uuid): Promise<ScaleTemplate | null> {
    const record = await this.prismaService.scaleTemplate.findUnique({
      where: { id: id.value },
    });
    return record ? this.mapToEntity(record) : null;
  }

  async findByIds(ids: Uuid[]): Promise<ScaleTemplate[]> {
    if (ids.length === 0) return [];

    const records = await this.prismaService.scaleTemplate.findMany({
      where: { id: { in: ids.map((id) => id.value) } },
    });
    return records.map((record) => this.mapToEntity(record));
  }

  async findByCodeAndVersion(code: string, version: number): Promise<ScaleTemplate | null> {
    const record = await this.prismaService.scaleTemplate.findUnique({
      where: { code_version: { code, version } },
    });
    return record ? this.mapToEntity(record) : null;
  }

  async findLatestByCode(code: string): Promise<ScaleTemplate | null> {
    const record = await this.prismaService.scaleTemplate.findFirst({
      where: { code },
      orderBy: { version: "desc" },
    });
    return record ? this.mapToEntity(record) : null;
  }

  async listCatalog(): Promise<ScaleTemplate[]> {
    // O catálogo é pequeno (poucas escalas e versões): filtra em memória.
    const records = await this.prismaService.scaleTemplate.findMany({
      orderBy: [{ code: "asc" }, { version: "desc" }],
    });

    const latestByCode = new Map<string, PrismaScaleTemplate>();
    for (const record of records) {
      if (!latestByCode.has(record.code)) latestByCode.set(record.code, record);
    }

    return [...latestByCode.values()]
      .filter((record) => record.active)
      .map((record) => this.mapToEntity(record))
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  private mapToEntity(record: PrismaScaleTemplate): ScaleTemplate {
    return ScaleTemplate.fromPersistence({
      id: new Uuid(record.id),
      code: record.code,
      version: record.version,
      name: record.name,
      description: record.description,
      instructions: record.instructions,
      respondent: record.respondent as ScaleRespondent,
      ageRange: record.ageRange
        ? { min: record.ageRange.min, max: record.ageRange.max }
        : undefined,
      estimatedMinutes: record.estimatedMinutes,
      options: record.options.map((option) => ({
        value: option.value,
        label: option.label,
      })),
      items: record.items.map((item) => ({
        id: item.id,
        order: item.order,
        text: item.text,
        subscaleCode: item.subscaleCode ?? undefined,
      })),
      subscales: record.subscales.map((subscale) => ({
        code: subscale.code,
        name: subscale.name,
      })),
      scoring: {
        method: record.scoring.method as ScoringMethod,
        bands: record.scoring.bands.map((band) => ({
          subscaleCode: band.subscaleCode ?? undefined,
          min: band.min,
          max: band.max,
          label: band.label,
          severity: band.severity as BandSeverity,
        })),
      },
      disclaimer: record.disclaimer,
      reference: record.reference,
      active: record.active,
    });
  }
}
