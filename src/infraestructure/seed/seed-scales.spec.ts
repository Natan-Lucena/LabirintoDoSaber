import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { Uuid } from "@wave-telecom/framework/core";
import { loadScaleFiles, ScaleSeedError, seedScales } from "./seed-scales";
import { loadDemoDefinition } from "../../domain/tests/entities/scale-fixtures";

const SCALES_DIR = path.resolve(__dirname, "../../../scales");

// Prisma simulado com um "banco" em memória, indexado por code + version.
const makePrisma = () => {
  const records = new Map<string, any>();
  const key = (code: string, version: number) => `${code}@${version}`;

  const scaleTemplate = {
    findUnique: vi.fn(async ({ where }: any) => {
      if (where.code_version) {
        return records.get(key(where.code_version.code, where.code_version.version)) ?? null;
      }
      return [...records.values()].find((record) => record.id === where.id) ?? null;
    }),
    upsert: vi.fn(async ({ create }: any) => {
      // Simula o Mongo: opcionais gravados como null voltam como null.
      records.set(key(create.code, create.version), JSON.parse(JSON.stringify(create)));
    }),
  };

  return { prisma: { scaleTemplate } as unknown as PrismaClient, scaleTemplate, records };
};

const file = (content: unknown, source = "demo-rastreio.v1.json") => ({ source, content });

describe("seedScales", () => {
  let mock: ReturnType<typeof makePrisma>;

  beforeEach(() => {
    mock = makePrisma();
  });

  it("should create a new version with a generated UUID", async () => {
    const report = await seedScales(mock.prisma, [file(loadDemoDefinition())]);

    expect(report).toEqual({ created: ["DEMO-RASTREIO v1"], unchanged: [] });
    expect(mock.scaleTemplate.upsert).toHaveBeenCalledTimes(1);
    const record = mock.records.get("DEMO-RASTREIO@1");
    expect(Uuid.isValid(record.id)).toBe(true);
    expect(record.items).toHaveLength(8);
  });

  it("should be idempotent when run twice", async () => {
    await seedScales(mock.prisma, [file(loadDemoDefinition())]);
    const report = await seedScales(mock.prisma, [file(loadDemoDefinition())]);

    expect(report).toEqual({ created: [], unchanged: ["DEMO-RASTREIO v1"] });
    expect(mock.scaleTemplate.upsert).toHaveBeenCalledTimes(1);
    expect(mock.records.size).toBe(1);
  });

  it("should abort when the content of a published version changed", async () => {
    await seedScales(mock.prisma, [file(loadDemoDefinition())]);
    const changed = loadDemoDefinition();
    changed.items[0].text = "Outro texto";

    await expect(seedScales(mock.prisma, [file(changed)])).rejects.toThrow(ScaleSeedError);
    await expect(seedScales(mock.prisma, [file(changed)])).rejects.toThrow(
      /DEMO-RASTREIO v1/
    );
    expect(mock.scaleTemplate.upsert).toHaveBeenCalledTimes(1);
  });

  it("should create version N+1 next to the published version", async () => {
    await seedScales(mock.prisma, [file(loadDemoDefinition())]);
    const next = { ...loadDemoDefinition(), version: 2, active: false };

    const report = await seedScales(mock.prisma, [
      file(loadDemoDefinition()),
      file(next, "demo-rastreio.v2.json"),
    ]);

    expect(report).toEqual({ created: ["DEMO-RASTREIO v2"], unchanged: ["DEMO-RASTREIO v1"] });
    expect(mock.records.size).toBe(2);
  });

  it("should abort with the validation errors and write nothing", async () => {
    const invalid = { ...loadDemoDefinition(), code: "OUTRA" };
    invalid.items[0].subscaleCode = "MEMORIA";

    const run = seedScales(mock.prisma, [file(loadDemoDefinition()), file(invalid, "outra.v1.json")]);

    await expect(run).rejects.toThrow(/outra\.v1\.json.*UNKNOWN_SUBSCALE/s);
    expect(mock.scaleTemplate.upsert).not.toHaveBeenCalled();
  });

  it("should abort on a file with a malformed shape", async () => {
    const { disclaimer: _disclaimer, ...withoutDisclaimer } = loadDemoDefinition();

    await expect(seedScales(mock.prisma, [file(withoutDisclaimer)])).rejects.toThrow(
      /disclaimer/
    );
    expect(mock.scaleTemplate.upsert).not.toHaveBeenCalled();
  });

  it("should abort when two files publish the same code and version", async () => {
    await expect(
      seedScales(mock.prisma, [file(loadDemoDefinition()), file(loadDemoDefinition(), "copia.json")])
    ).rejects.toThrow(/DUPLICATE_VERSION/);
    expect(mock.scaleTemplate.upsert).not.toHaveBeenCalled();
  });
});

describe("loadScaleFiles", () => {
  it("should load the demo scale from scales/ and it should be valid", async () => {
    const files = loadScaleFiles(SCALES_DIR);
    const demo = files.find((loaded) => loaded.source === "demo-rastreio.v1.json");

    expect(demo).toBeDefined();
    const mock = makePrisma();
    await expect(seedScales(mock.prisma, files)).resolves.toBeDefined();
  });

  it("should keep the demo scale explicitly fictitious (BE-AV-01)", () => {
    const demo = loadDemoDefinition();
    const notice = "Escala fictícia para testes de integração. Não tem validade clínica.";

    expect(demo.code).toBe("DEMO-RASTREIO");
    expect(demo.name.startsWith("Demonstração")).toBe(true);
    expect(demo.description).toContain(notice);
    expect(demo.reference).toContain(notice);
    expect(demo.disclaimer).toBe("O resultado não substitui avaliação clínica completa.");
    expect(demo.items.length).toBeGreaterThan(0);
    expect(demo.options.map((option) => option.label)).toEqual([
      "Nunca",
      "Às vezes",
      "Frequentemente",
      "Muito",
    ]);
    expect(demo.scoring.bands.length).toBeGreaterThan(0);
  });
});
