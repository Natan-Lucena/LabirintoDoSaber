import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { ScaleTemplateRepository } from "../../../../../domain/repositories/scale-template-repository";
import { makeDemoTemplate } from "../../../../../domain/tests/entities/scale-fixtures";
import { GetScaleTemplateUseCase } from "./get-scale-template-use-case";

describe("GetScaleTemplateUseCase", () => {
  const template = makeDemoTemplate();
  let repository: ScaleTemplateRepository;
  let useCase: GetScaleTemplateUseCase;

  beforeEach(() => {
    repository = {
      findById: vi.fn().mockResolvedValue(template),
    } as unknown as ScaleTemplateRepository;
    useCase = new GetScaleTemplateUseCase(repository);
  });

  it("should return the template", async () => {
    const result = await useCase.execute({ templateId: template.id.value });

    expect(result).toEqual({ ok: true, value: template });
  });

  it("should return SCALE_NOT_FOUND for an invalid id without querying", async () => {
    const result = await useCase.execute({ templateId: "nao-e-uuid" });

    expect(result).toEqual({ ok: false, error: "SCALE_NOT_FOUND" });
    expect(repository.findById).not.toHaveBeenCalled();
  });

  it("should return SCALE_NOT_FOUND for a missing template", async () => {
    (repository.findById as any).mockResolvedValue(null);

    const result = await useCase.execute({ templateId: Uuid.random().value });

    expect(result).toEqual({ ok: false, error: "SCALE_NOT_FOUND" });
  });
});
