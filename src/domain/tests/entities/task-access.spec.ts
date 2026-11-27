import { describe, it, expect } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import {
  isLegacyTask,
  isUsableBy,
  Task,
  TaskCategory,
  TaskSource,
  TaskType,
} from "../../entities/task";

const make = (extra: Partial<Parameters<typeof Task.create>[0]> = {}) => {
  const created = Task.create({
    category: TaskCategory.Writing,
    type: TaskType.WordBuilder,
    prompt: "Monte a palavra",
    content: { kind: "wordBuilder", word: "BOLA" },
    ...extra,
  });
  if (!created.ok) throw new Error("fixture");
  return created.value;
};

describe("isUsableBy", () => {
  const me = Uuid.random();
  const other = Uuid.random();

  it("biblioteca: qualquer educador", () => {
    const library = make({ source: TaskSource.Library });
    expect(isLegacyTask(library)).toBe(false);
    expect(isUsableBy(library, me)).toBe(true);
  });

  it("com dono gravado: só o dono", () => {
    expect(isUsableBy(make({ educatorId: me }), me)).toBe(true);
    expect(isUsableBy(make({ educatorId: other }), me)).toBe(false);
  });

  it("legado avulso (sem dono e fora de caderno/grupo): qualquer educador", () => {
    const legacy = make();
    expect(isLegacyTask(legacy)).toBe(true);
    expect(isUsableBy(legacy, me, [])).toBe(true);
    expect(isUsableBy(legacy, me)).toBe(true);
  });

  it("legado em caderno/grupo: só os donos desses cadernos/grupos", () => {
    const legacy = make();
    expect(isUsableBy(legacy, me, [me.value, other.value])).toBe(true);
    expect(isUsableBy(legacy, me, [other.value])).toBe(false);
  });
});
