import { describe, it, expect } from "vitest";
import {
  BandSeverity,
  ScaleBand,
  ScaleDefinition,
  ScaleTemplate,
  ScoringMethod,
  validateDefinition,
} from "../../entities/scale-template";
import {
  demoAnswers,
  loadDemoDefinition,
  makeDemoTemplate,
} from "./scale-fixtures";

const replaceBands = (
  definition: ScaleDefinition,
  subscaleCode: string | undefined,
  bands: Omit<ScaleBand, "subscaleCode" | "label">[]
): ScaleDefinition => ({
  ...definition,
  scoring: {
    ...definition.scoring,
    bands: [
      ...definition.scoring.bands.filter((band) => band.subscaleCode !== subscaleCode),
      ...bands.map((band) => ({ ...band, subscaleCode, label: "Faixa" })),
    ],
  },
});

const meanBands = [
  { min: 0, max: 1, severity: BandSeverity.LOW },
  { min: 1.01, max: 2, severity: BandSeverity.MODERATE },
  { min: 2.01, max: 3, severity: BandSeverity.HIGH },
];

// A demo com método MEAN: todos os alvos vão de 0 a 3.
const meanDefinition = (): ScaleDefinition => {
  let definition: ScaleDefinition = {
    ...loadDemoDefinition(),
    scoring: { method: ScoringMethod.MEAN, bands: [] },
  };
  for (const target of [undefined, "ATENCAO", "INQUIETACAO"]) {
    definition = replaceBands(definition, target, meanBands);
  }
  return definition;
};

const errorCodes = (definition: ScaleDefinition) =>
  validateDefinition(definition).map((error) => error.split(":")[0]);

describe("validateDefinition", () => {
  it("should accept the demo scale", () => {
    expect(validateDefinition(loadDemoDefinition())).toEqual([]);
  });

  it("should accept contiguous MEAN bands with a 0.01 step", () => {
    expect(validateDefinition(meanDefinition())).toEqual([]);
  });

  it("should reject total bands with a gap", () => {
    const definition = replaceBands(loadDemoDefinition(), undefined, [
      { min: 0, max: 8, severity: BandSeverity.LOW },
      { min: 10, max: 16, severity: BandSeverity.MODERATE },
      { min: 17, max: 24, severity: BandSeverity.HIGH },
    ]);

    expect(errorCodes(definition)).toContain("BAND_GAP");
  });

  it("should reject overlapping total bands", () => {
    const definition = replaceBands(loadDemoDefinition(), undefined, [
      { min: 0, max: 8, severity: BandSeverity.LOW },
      { min: 8, max: 16, severity: BandSeverity.MODERATE },
      { min: 17, max: 24, severity: BandSeverity.HIGH },
    ]);

    expect(errorCodes(definition)).toContain("BAND_OVERLAP");
  });

  it("should reject subscale bands with a gap", () => {
    const definition = replaceBands(loadDemoDefinition(), "ATENCAO", [
      { min: 0, max: 4, severity: BandSeverity.LOW },
      { min: 6, max: 12, severity: BandSeverity.HIGH },
    ]);

    expect(errorCodes(definition)).toContain("BAND_GAP");
  });

  it("should reject bands that do not cover the whole possible range", () => {
    const definition = replaceBands(loadDemoDefinition(), undefined, [
      { min: 1, max: 8, severity: BandSeverity.LOW },
      { min: 9, max: 16, severity: BandSeverity.MODERATE },
      { min: 17, max: 23, severity: BandSeverity.HIGH },
    ]);

    expect(errorCodes(definition)).toEqual(["BAND_RANGE", "BAND_RANGE"]);
  });

  it("should reject a target without bands", () => {
    const definition = replaceBands(loadDemoDefinition(), "INQUIETACAO", []);

    expect(errorCodes(definition)).toContain("MISSING_BANDS");
  });

  it("should reject SUM band bounds that are not integers", () => {
    const definition = replaceBands(loadDemoDefinition(), undefined, [
      { min: 0, max: 7.5, severity: BandSeverity.LOW },
      { min: 8.4, max: 16, severity: BandSeverity.MODERATE },
      { min: 17, max: 24, severity: BandSeverity.HIGH },
    ]);

    const codes = errorCodes(definition);
    expect(codes).toContain("INVALID_BAND_BOUND");
    expect(codes).toContain("BAND_GAP");
  });

  it("should reject MEAN band bounds with more than two decimals", () => {
    const definition = replaceBands(meanDefinition(), undefined, [
      { min: 0, max: 1.985, severity: BandSeverity.LOW },
      { min: 1.995, max: 3, severity: BandSeverity.HIGH },
    ]);

    expect(errorCodes(definition)).toContain("INVALID_BAND_BOUND");
  });

  it("should reject MEAN bands with a gap above 0.01 or overlapping", () => {
    const gap = replaceBands(meanDefinition(), undefined, [
      { min: 0, max: 1.5, severity: BandSeverity.LOW },
      { min: 1.6, max: 3, severity: BandSeverity.HIGH },
    ]);
    const overlap = replaceBands(meanDefinition(), undefined, [
      { min: 0, max: 1.5, severity: BandSeverity.LOW },
      { min: 1.5, max: 3, severity: BandSeverity.HIGH },
    ]);

    expect(errorCodes(gap)).toContain("BAND_GAP");
    expect(errorCodes(overlap)).toContain("BAND_OVERLAP");
  });

  it("should reject an item with an unknown subscale", () => {
    const definition = loadDemoDefinition();
    definition.items[0].subscaleCode = "MEMORIA";

    expect(errorCodes(definition)).toContain("UNKNOWN_SUBSCALE");
  });

  it("should reject a band with an unknown subscale", () => {
    const definition = loadDemoDefinition();
    definition.scoring.bands.push({
      subscaleCode: "MEMORIA",
      min: 0,
      max: 12,
      label: "Faixa",
      severity: BandSeverity.LOW,
    });

    expect(errorCodes(definition)).toContain("UNKNOWN_SUBSCALE");
  });

  it("should reject fewer than 2 or more than 7 options", () => {
    const one = loadDemoDefinition();
    one.options = [{ value: 0, label: "Nunca" }];
    const eight = loadDemoDefinition();
    eight.options = Array.from({ length: 8 }, (_, value) => ({ value, label: `${value}` }));

    expect(errorCodes(one)).toContain("INVALID_OPTIONS");
    expect(errorCodes(eight)).toContain("INVALID_OPTIONS");
  });

  it("should reject repeated option values, item ids and item orders", () => {
    const definition = loadDemoDefinition();
    definition.options[1].value = 0;
    definition.items[1].id = "demo-1";
    definition.items[2].order = 1;

    const codes = errorCodes(definition);
    expect(codes).toContain("DUPLICATE_OPTION_VALUE");
    expect(codes).toContain("DUPLICATE_ITEM_ID");
    expect(codes).toContain("DUPLICATE_ITEM_ORDER");
  });
});

describe("ScaleTemplate.create", () => {
  it("should create a template from a valid definition", () => {
    const result = ScaleTemplate.create(loadDemoDefinition());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.code).toBe("DEMO-RASTREIO");
    expect(result.value.version).toBe(1);
  });

  it("should return the validation errors of an invalid definition", () => {
    const definition = loadDemoDefinition();
    definition.items[0].subscaleCode = "MEMORIA";

    const result = ScaleTemplate.create(definition);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("INVALID_SCALE_DEFINITION");
    expect(result.error.errors.length).toBeGreaterThan(0);
  });
});

describe("ScaleTemplate.computeScore (demo scale)", () => {
  const template = makeDemoTemplate();
  const band = (severity: BandSeverity) =>
    expect.objectContaining({ severity, label: expect.any(String) });

  it("should have no band when nothing was answered", () => {
    const score = template.computeScore([]);

    expect(score).toMatchObject({ partial: true, answered: 0, total: 8, value: 0, max: 24 });
    expect(score.band).toBeUndefined();
    expect(score.subscales).toHaveLength(2);
    for (const subscale of score.subscales) {
      expect(subscale).toMatchObject({ value: 0, max: 12, answered: 0, total: 4 });
      expect(subscale.band).toBeUndefined();
    }
  });

  it("should compute a partial score with the band over the answered items", () => {
    const score = template.computeScore(demoAnswers([3, 3, 3, 3]));

    expect(score).toMatchObject({ partial: true, answered: 4, total: 8, value: 12, max: 24 });
    expect(score.band).toEqual(band(BandSeverity.MODERATE));
    expect(score.subscales[0]).toMatchObject({
      code: "ATENCAO",
      name: "Demonstração — Atenção",
      value: 12,
      max: 12,
      band: band(BandSeverity.HIGH),
    });
    expect(score.subscales[1]).toMatchObject({ code: "INQUIETACAO", value: 0, answered: 0 });
    expect(score.subscales[1].band).toBeUndefined();
  });

  it("should score the minimum as LOW", () => {
    const score = template.computeScore(demoAnswers([0, 0, 0, 0, 0, 0, 0, 0]));

    expect(score).toMatchObject({ partial: false, answered: 8, value: 0, max: 24 });
    expect(score.band).toEqual(band(BandSeverity.LOW));
    expect(score.subscales.map((subscale) => subscale.band?.severity)).toEqual([
      BandSeverity.LOW,
      BandSeverity.LOW,
    ]);
  });

  it("should score the maximum as HIGH", () => {
    const score = template.computeScore(demoAnswers([3, 3, 3, 3, 3, 3, 3, 3]));

    expect(score).toMatchObject({ partial: false, answered: 8, value: 24, max: 24 });
    expect(score.band).toEqual(band(BandSeverity.HIGH));
    expect(score.subscales.map((subscale) => subscale.value)).toEqual([12, 12]);
    expect(score.subscales.map((subscale) => subscale.band?.severity)).toEqual([
      BandSeverity.HIGH,
      BandSeverity.HIGH,
    ]);
  });

  it("should score an intermediate value by the demo table", () => {
    const score = template.computeScore(demoAnswers([2, 2, 1, 1, 2, 1, 1, 2]));

    expect(score).toMatchObject({ partial: false, value: 12 });
    expect(score.band).toEqual(band(BandSeverity.MODERATE));
    expect(score.subscales).toEqual([
      expect.objectContaining({ code: "ATENCAO", value: 6, band: band(BandSeverity.MODERATE) }),
      expect.objectContaining({ code: "INQUIETACAO", value: 6, band: band(BandSeverity.MODERATE) }),
    ]);
  });

  it("should place the band limits of the demo table on the right side", () => {
    const severityOf = (values: number[]) => template.computeScore(demoAnswers(values)).band?.severity;

    expect(severityOf([3, 3, 2, 0, 0, 0, 0, 0])).toBe(BandSeverity.LOW); // 8
    expect(severityOf([3, 3, 3, 0, 0, 0, 0, 0])).toBe(BandSeverity.MODERATE); // 9
    expect(severityOf([3, 3, 3, 3, 3, 1, 0, 0])).toBe(BandSeverity.MODERATE); // 16
    expect(severityOf([3, 3, 3, 3, 3, 2, 0, 0])).toBe(BandSeverity.HIGH); // 17
  });

  it("should ignore answers of items outside the scale", () => {
    const score = template.computeScore([
      { itemId: "demo-1", value: 3 },
      { itemId: "outro", value: 3 },
    ]);

    expect(score).toMatchObject({ answered: 1, value: 3 });
  });
});

describe("ScaleTemplate.computeScore (MEAN)", () => {
  const template = ScaleTemplate.fromPersistence({
    ...meanDefinition(),
    id: makeDemoTemplate().id,
  });

  it("should average the answered items with two decimals", () => {
    const score = template.computeScore(demoAnswers([1, 1, 2]));

    expect(score).toMatchObject({ partial: true, answered: 3, total: 8, value: 1.33, max: 3 });
    expect(score.band?.severity).toBe(BandSeverity.MODERATE);
    expect(score.subscales[0]).toMatchObject({ value: 1.33, max: 3 });
    expect(score.subscales[1]).toMatchObject({ value: 0, max: 3 });
    expect(score.subscales[1].band).toBeUndefined();
  });

  it("should use the lowest option as the value when nothing was answered", () => {
    let definition: ScaleDefinition = {
      ...meanDefinition(),
      options: [
        { value: 1, label: "Nunca" },
        { value: 2, label: "Às vezes" },
        { value: 3, label: "Frequentemente" },
        { value: 4, label: "Muito" },
      ],
    };
    for (const target of [undefined, "ATENCAO", "INQUIETACAO"]) {
      definition = replaceBands(definition, target, [
        { min: 1, max: 2, severity: BandSeverity.LOW },
        { min: 2.01, max: 4, severity: BandSeverity.HIGH },
      ]);
    }
    expect(validateDefinition(definition)).toEqual([]);
    const fromOne = ScaleTemplate.fromPersistence({ ...definition, id: template.id });

    const score = fromOne.computeScore([]);

    expect(score).toMatchObject({ partial: true, answered: 0, value: 1, max: 4 });
    expect(score.band).toBeUndefined();
    expect(score.subscales.map((subscale) => subscale.value)).toEqual([1, 1]);
  });

  it("should use the mean of a complete application", () => {
    const score = template.computeScore(demoAnswers([3, 3, 3, 3, 2, 2, 2, 2]));

    expect(score).toMatchObject({ partial: false, value: 2.5, max: 3 });
    expect(score.band?.severity).toBe(BandSeverity.HIGH);
    expect(score.subscales.map((subscale) => subscale.value)).toEqual([3, 2]);
    expect(score.subscales.map((subscale) => subscale.band?.severity)).toEqual([
      BandSeverity.HIGH,
      BandSeverity.MODERATE,
    ]);
  });
});
