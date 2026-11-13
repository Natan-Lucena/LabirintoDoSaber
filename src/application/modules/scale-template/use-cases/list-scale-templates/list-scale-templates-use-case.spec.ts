import { describe, it, expect, vi } from "vitest";
import { ScaleTemplateRepository } from "../../../../../domain/repositories/scale-template-repository";
import { makeDemoTemplate } from "../../../../../domain/tests/entities/scale-fixtures";
import { ListScaleTemplatesUseCase } from "./list-scale-templates-use-case";

describe("ListScaleTemplatesUseCase", () => {
  it("should return the catalog (latest active version of each scale)", async () => {
    const template = makeDemoTemplate();
    const repository = {
      listCatalog: vi.fn().mockResolvedValue([template]),
    } as unknown as ScaleTemplateRepository;

    const result = await new ListScaleTemplatesUseCase(repository).execute();

    expect(result).toEqual({ ok: true, value: [template] });
    expect(repository.listCatalog).toHaveBeenCalledTimes(1);
  });
});
