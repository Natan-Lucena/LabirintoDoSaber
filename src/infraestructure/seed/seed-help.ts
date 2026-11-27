// Carga da central de ajuda (AJ-01): tutoriais de help/tutorials.json. Usado
// por scripts/seed-help.ts. Idempotente: cria o que falta, atualiza o que mudou
// e apaga o que saiu do arquivo (o arquivo é a fonte; nada referencia tutorial).
import { readFileSync } from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import { z } from "zod";
import { HelpTutorial } from "../../domain/entities/help-tutorial";
import { HelpTutorialRepositoryImpl } from "../repositories/prisma/help-tutorial-repository-impl";

const HELP_NAMESPACE = "3b8e5f2a-7c1d-4e9b-a6f0-5d4c3b2a1e0f";

// Formato do arquivo; limites e URLs são conferidos pela entidade.
const tutorialsFileSchema = z.array(
  z
    .object({
      key: z.string().regex(/^[a-z0-9-]+$/, "use minúsculas, números e hífen"),
      order: z.number(),
      title: z.string(),
      description: z.string(),
      durationSeconds: z.number(),
      featured: z.boolean().default(false),
      videoUrl: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      steps: z.array(z.string()).optional(),
    })
    .strict()
);

export interface HelpSeedReport {
  created: string[];
  updated: string[];
  unchanged: string[];
  removed: string[];
}

export class HelpSeedError extends Error {
  constructor(readonly errors: string[]) {
    super(`Seed da central de ajuda abortado:\n- ${errors.join("\n- ")}`);
    this.name = "HelpSeedError";
  }
}

export function loadHelpTutorials(directory: string): unknown {
  return JSON.parse(readFileSync(path.join(directory, "tutorials.json"), "utf-8")) as unknown;
}

// Id estável por chave: rodar de novo encontra o mesmo tutorial.
export const helpTutorialId = (key: string) => Uuid.fromSeed(`help-tutorial:${key}`, HELP_NAMESPACE);

const fingerprint = (tutorial: HelpTutorial) =>
  JSON.stringify([
    tutorial.order,
    tutorial.title,
    tutorial.description,
    tutorial.durationSeconds,
    tutorial.featured,
    tutorial.videoUrl ?? null,
    tutorial.thumbnailUrl ?? null,
    tutorial.steps ?? [],
  ]);

// Valida tudo antes de gravar qualquer coisa.
export async function seedHelpTutorials(
  prisma: PrismaClient,
  content: unknown
): Promise<HelpSeedReport> {
  const repository = new HelpTutorialRepositoryImpl(prisma);
  const errors: string[] = [];
  const tutorials: { key: string; tutorial: HelpTutorial }[] = [];

  const parsed = tutorialsFileSchema.safeParse(content);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push(`tutorials.json: INVALID_SHAPE: ${issue.path.join(".")} ${issue.message}`);
    }
    throw new HelpSeedError(errors);
  }

  for (const { key, ...definition } of parsed.data) {
    const label = `tutorials.json: ${key}`;
    if (tutorials.some((entry) => entry.key === key)) {
      errors.push(`${label}: DUPLICATE_KEY`);
      continue;
    }
    if (tutorials.some((entry) => entry.tutorial.order === definition.order)) {
      errors.push(`${label}: DUPLICATE_ORDER: ${definition.order}`);
      continue;
    }
    const created = HelpTutorial.create({ id: helpTutorialId(key), ...definition });
    if (!created.ok) {
      errors.push(...created.error.errors.map((error) => `${label}: ${error}`));
      continue;
    }
    tutorials.push({ key, tutorial: created.value });
  }

  const featured = tutorials.filter(({ tutorial }) => tutorial.featured);
  if (featured.length > 1) {
    errors.push(`tutorials.json: FEATURED: no máximo um (${featured.map((t) => t.key).join(", ")})`);
  }

  if (errors.length > 0) throw new HelpSeedError(errors);

  const report: HelpSeedReport = { created: [], updated: [], unchanged: [], removed: [] };
  const existing = new Map((await repository.listAll()).map((t) => [t.id.value, t]));

  const toSave: HelpTutorial[] = [];
  for (const { key, tutorial } of tutorials) {
    const current = existing.get(tutorial.id.value);
    if (!current) report.created.push(key);
    else if (fingerprint(current) === fingerprint(tutorial)) {
      report.unchanged.push(key);
      continue;
    } else report.updated.push(key);
    toSave.push(tutorial);
  }

  const kept = new Set(tutorials.map(({ tutorial }) => tutorial.id.value));
  const removed = [...existing.values()].filter((t) => !kept.has(t.id.value));
  report.removed.push(...removed.map((t) => t.title));

  for (const tutorial of toSave) await repository.save(tutorial);
  await repository.deleteByIds(removed.map((t) => t.id));

  return report;
}
