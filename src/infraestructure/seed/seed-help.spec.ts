import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { helpTutorialId, HelpSeedError, loadHelpTutorials, seedHelpTutorials } from "./seed-help";

const HELP_DIR = path.resolve(__dirname, "../../../help");

// Prisma simulado com um "banco" em memória, indexado por id.
const makePrisma = () => {
  const records = new Map<string, any>();
  const helpTutorial = {
    findMany: vi.fn(async () =>
      [...records.values()].sort((a, b) => a.order - b.order).map((r) => ({ ...r }))
    ),
    upsert: vi.fn(async ({ where, create }: any) => {
      // Simula o Mongo: opcionais gravados como null voltam como null.
      records.set(where.id, JSON.parse(JSON.stringify(create)));
    }),
    deleteMany: vi.fn(async ({ where }: any) => {
      for (const id of where.id.in) records.delete(id);
      return { count: where.id.in.length };
    }),
  };
  return { prisma: { helpTutorial } as unknown as PrismaClient, helpTutorial, records };
};

const entry = (key: string, order: number, extra: Record<string, unknown> = {}) => ({
  key,
  order,
  title: `Tutorial ${key}`,
  description: "Descrição curta.",
  durationSeconds: 60,
  featured: false,
  steps: ["Primeiro passo."],
  ...extra,
});

describe("seedHelpTutorials (AJ-01)", () => {
  let mock: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    mock = makePrisma();
  });

  it("should load the versioned file: 4 to 6 text tutorials, one featured, no video", async () => {
    const content = loadHelpTutorials(HELP_DIR) as any[];

    expect(content.length).toBeGreaterThanOrEqual(4);
    expect(content.length).toBeLessThanOrEqual(6);
    const featured = content.filter((t) => t.featured);
    expect(featured).toHaveLength(1);
    expect(featured[0].title).toBe("Conheça o Labirinto do Saber");
    for (const tutorial of content) {
      expect(tutorial.videoUrl).toBeUndefined();
      expect(tutorial.steps.length).toBeGreaterThan(0);
    }

    const report = await seedHelpTutorials(mock.prisma, content);
    expect(report.created).toHaveLength(content.length);
  });

  it("should create with stable ids and be idempotent", async () => {
    const content = [entry("inicio", 1, { featured: true }), entry("agenda", 2)];

    const first = await seedHelpTutorials(mock.prisma, content);
    const second = await seedHelpTutorials(mock.prisma, content);

    expect(first).toEqual({ created: ["inicio", "agenda"], updated: [], unchanged: [], removed: [] });
    expect(second).toEqual({ created: [], updated: [], unchanged: ["inicio", "agenda"], removed: [] });
    expect(mock.helpTutorial.upsert).toHaveBeenCalledTimes(2);
    expect([...mock.records.keys()].sort()).toEqual(
      [helpTutorialId("inicio").value, helpTutorialId("agenda").value].sort()
    );
    // Opcional ausente gravado como null.
    expect(mock.records.get(helpTutorialId("agenda").value).videoUrl).toBeNull();
  });

  it("should update what changed and remove what left the file", async () => {
    await seedHelpTutorials(mock.prisma, [entry("inicio", 1), entry("agenda", 2)]);

    const report = await seedHelpTutorials(mock.prisma, [
      entry("inicio", 1, { title: "Novo título" }),
    ]);

    // O que saiu do arquivo aparece pelo título (a chave não é gravada).
    expect(report).toEqual({
      created: [],
      updated: ["inicio"],
      unchanged: [],
      removed: ["Tutorial agenda"],
    });
    expect(mock.records.size).toBe(1);
    expect(mock.records.get(helpTutorialId("inicio").value).title).toBe("Novo título");
  });

  it("should abort without writing when there is more than one featured", async () => {
    const content = [entry("a", 1, { featured: true }), entry("b", 2, { featured: true })];

    await expect(seedHelpTutorials(mock.prisma, content)).rejects.toThrow(HelpSeedError);
    await expect(seedHelpTutorials(mock.prisma, content)).rejects.toThrow(/FEATURED/);
    expect(mock.helpTutorial.upsert).not.toHaveBeenCalled();
  });

  it("should abort on duplicated order or key", async () => {
    await expect(
      seedHelpTutorials(mock.prisma, [entry("a", 1), entry("b", 1)])
    ).rejects.toThrow(/DUPLICATE_ORDER/);
    await expect(
      seedHelpTutorials(mock.prisma, [entry("a", 1), entry("a", 2)])
    ).rejects.toThrow(/DUPLICATE_KEY/);
    expect(mock.helpTutorial.upsert).not.toHaveBeenCalled();
  });

  it("should abort on a video that is not https and on the size limits", async () => {
    await expect(
      seedHelpTutorials(mock.prisma, [entry("a", 1, { videoUrl: "http://x.com/a.mp4" })])
    ).rejects.toThrow(/videoUrl/);
    await expect(
      seedHelpTutorials(mock.prisma, [entry("a", 1, { title: "t".repeat(81) })])
    ).rejects.toThrow(/title/);
    await expect(
      seedHelpTutorials(mock.prisma, [
        entry("a", 1, { steps: Array.from({ length: 11 }, () => "passo") }),
      ])
    ).rejects.toThrow(/steps/);
    expect(mock.helpTutorial.upsert).not.toHaveBeenCalled();
  });

  it("should abort on an unknown field or a wrong shape", async () => {
    await expect(
      seedHelpTutorials(mock.prisma, [entry("a", 1, { extra: true })])
    ).rejects.toThrow(/INVALID_SHAPE/);
    await expect(seedHelpTutorials(mock.prisma, { not: "a list" })).rejects.toThrow(
      /INVALID_SHAPE/
    );
  });
});
