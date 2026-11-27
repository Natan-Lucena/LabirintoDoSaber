import { describe, it, expect, vi } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { ListHelpTutorialsUseCase } from "./list-help-tutorials-use-case";
import { HelpTutorial } from "../../../../../domain/entities/help-tutorial";
import { HelpTutorialRepository } from "../../../../../domain/repositories/help-tutorial-repository";

const tutorial = (order: number, featured = false, extra: Partial<{ videoUrl: string }> = {}) =>
  HelpTutorial.fromPersistence({
    id: Uuid.random(),
    order,
    title: `Tutorial ${order}`,
    description: "Descrição",
    durationSeconds: 60,
    featured,
    steps: ["Passo 1"],
    ...extra,
  });

const repositoryWith = (tutorials: HelpTutorial[]) =>
  ({
    listAll: vi.fn(async () => tutorials),
    save: vi.fn(),
    deleteByIds: vi.fn(),
  }) as unknown as HelpTutorialRepository;

describe("ListHelpTutorialsUseCase (BE-AJ-01)", () => {
  it("should return the tutorials by order", async () => {
    const useCase = new ListHelpTutorialsUseCase(
      repositoryWith([tutorial(3), tutorial(1, true), tutorial(2)])
    );

    const result = await useCase.execute();

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.map((t) => t.order)).toEqual([1, 2, 3]);
    expect(result.value[0]).toEqual({
      id: expect.any(String),
      order: 1,
      title: "Tutorial 1",
      description: "Descrição",
      durationSeconds: 60,
      featured: true,
      steps: ["Passo 1"],
    });
    // Opcionais ausentes ficam fora do JSON.
    expect(result.value[0]).not.toHaveProperty("videoUrl");
  });

  it("should keep at most one featured, the first by order", async () => {
    const useCase = new ListHelpTutorialsUseCase(
      repositoryWith([tutorial(2, true), tutorial(5, true), tutorial(1)])
    );

    const result = await useCase.execute();

    if (!result.ok) throw new Error("esperava sucesso");
    expect(result.value.map((t) => [t.order, t.featured])).toEqual([
      [1, false],
      [2, true],
      [5, false],
    ]);
  });

  it("should return an empty list when there is no tutorial", async () => {
    const useCase = new ListHelpTutorialsUseCase(repositoryWith([]));

    expect(await useCase.execute()).toEqual({ ok: true, value: [] });
  });
});
