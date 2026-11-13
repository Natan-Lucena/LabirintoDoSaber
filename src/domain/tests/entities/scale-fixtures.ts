// Fábricas para os specs de escala, a partir da escala de demonstração real
// do seed (scales/demo-rastreio.v1.json).
import { readFileSync } from "fs";
import path from "path";
import { Uuid } from "@wave-telecom/framework/core";
import { ScaleDefinition, ScaleTemplate } from "../../entities/scale-template";

export const DEMO_SCALE_PATH = path.resolve(
  __dirname,
  "../../../../scales/demo-rastreio.v1.json"
);

// Cópia nova a cada chamada, para os specs poderem alterar à vontade.
export const loadDemoDefinition = (): ScaleDefinition =>
  JSON.parse(readFileSync(DEMO_SCALE_PATH, "utf-8"));

export const makeDemoTemplate = (overrides: Partial<ScaleDefinition> = {}) =>
  ScaleTemplate.fromPersistence({
    ...loadDemoDefinition(),
    ...overrides,
    id: Uuid.random(),
  });

export const DEMO_ITEM_IDS = [
  "demo-1",
  "demo-2",
  "demo-3",
  "demo-4",
  "demo-5",
  "demo-6",
  "demo-7",
  "demo-8",
];

// Uma resposta por item, na ordem de DEMO_ITEM_IDS.
export const demoAnswers = (values: number[]) =>
  values.map((value, index) => ({ itemId: DEMO_ITEM_IDS[index], value }));
