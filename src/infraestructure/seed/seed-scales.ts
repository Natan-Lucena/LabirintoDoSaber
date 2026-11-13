// Carga do catálogo de escalas (scales/*.json). Usado por scripts/seed-scales.ts.
// Versão publicada não muda: conteúdo diferente numa versão existente aborta.
import { readdirSync, readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import {
  BandSeverity,
  ScaleDefinition,
  ScaleRespondent,
  ScaleTemplate,
  ScoringMethod,
} from "../../domain/entities/scale-template";
import { ScaleTemplateRepositoryImpl } from "../repositories/prisma/scale-template-repository-impl";

const text = z.string().trim().min(1);

const scaleDefinitionSchema = z
  .object({
    code: text,
    version: z.number().int().min(1),
    name: text,
    description: text,
    instructions: text,
    respondent: z.nativeEnum(ScaleRespondent),
    ageRange: z.object({ min: z.number().int(), max: z.number().int() }).strict().optional(),
    estimatedMinutes: z.number().int().min(1),
    options: z.array(z.object({ value: z.number(), label: text }).strict()),
    items: z.array(
      z
        .object({
          id: text,
          order: z.number().int(),
          text,
          subscaleCode: text.optional(),
        })
        .strict()
    ),
    subscales: z.array(z.object({ code: text, name: text }).strict()),
    scoring: z
      .object({
        method: z.nativeEnum(ScoringMethod),
        bands: z.array(
          z
            .object({
              subscaleCode: text.optional(),
              min: z.number(),
              max: z.number(),
              label: text,
              severity: z.nativeEnum(BandSeverity),
            })
            .strict()
        ),
      })
      .strict(),
    disclaimer: text,
    reference: text,
    active: z.boolean(),
  })
  .strict();

export interface ScaleFile {
  source: string;
  content: unknown;
}

export interface ScaleSeedReport {
  created: string[];
  unchanged: string[];
}

export class ScaleSeedError extends Error {
  constructor(readonly errors: string[]) {
    super(`Seed de escalas abortado:\n- ${errors.join("\n- ")}`);
    this.name = "ScaleSeedError";
  }
}

export function loadScaleFiles(directory: string): ScaleFile[] {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".json"))
    .sort()
    .map((name) => ({
      source: name,
      content: JSON.parse(readFileSync(path.join(directory, name), "utf-8")),
    }));
}

// JSON com chaves ordenadas e sem undefined: compara conteúdo, não forma.
function canonical(value: unknown): string {
  const normalize = (current: unknown): unknown => {
    if (Array.isArray(current)) return current.map(normalize);
    if (current && typeof current === "object") {
      return Object.fromEntries(
        Object.entries(current as Record<string, unknown>)
          .filter(([, entry]) => entry !== undefined && entry !== null)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, entry]) => [key, normalize(entry)])
      );
    }
    return current;
  };
  return JSON.stringify(normalize(value));
}

const label = (definition: ScaleDefinition) => `${definition.code} v${definition.version}`;

// Valida tudo antes de gravar qualquer coisa; só cria versões novas.
export async function seedScales(
  prisma: PrismaClient,
  files: ScaleFile[]
): Promise<ScaleSeedReport> {
  const repository = new ScaleTemplateRepositoryImpl(prisma);
  const errors: string[] = [];
  const toCreate: ScaleTemplate[] = [];
  const unchanged: string[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const parsed = scaleDefinitionSchema.safeParse(file.content);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(`${file.source}: INVALID_SHAPE: ${issue.path.join(".")} ${issue.message}`);
      }
      continue;
    }
    const definition = parsed.data as ScaleDefinition;

    if (seen.has(label(definition))) {
      errors.push(`${file.source}: DUPLICATE_VERSION: ${label(definition)} em mais de um arquivo`);
      continue;
    }
    seen.add(label(definition));

    const created = ScaleTemplate.create(definition);
    if (!created.ok) {
      errors.push(...created.error.errors.map((error) => `${file.source}: ${error}`));
      continue;
    }

    const existing = await repository.findByCodeAndVersion(
      definition.code,
      definition.version
    );
    if (!existing) {
      toCreate.push(created.value);
    } else if (canonical(existing.definition) === canonical(definition)) {
      unchanged.push(label(definition));
    } else {
      errors.push(
        `${file.source}: VERSION_CHANGED: ${label(definition)} já publicada com outro conteúdo; crie a versão ${definition.version + 1}`
      );
    }
  }

  if (errors.length > 0) throw new ScaleSeedError(errors);

  for (const template of toCreate) await repository.save(template);

  return { created: toCreate.map((template) => label(template.definition)), unchanged };
}
