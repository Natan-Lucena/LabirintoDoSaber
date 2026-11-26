import { describe, it, expect } from "vitest";
import { ListTaskSkillsUseCase } from "./list-task-skills-use-case";
import { makeSkillRepository, SKILLS } from "../test-fixtures";

describe("ListTaskSkillsUseCase", () => {
  it("devolve code, label e learningTopics na ordem do catálogo", async () => {
    const useCase = new ListTaskSkillsUseCase(makeSkillRepository());

    const result = await useCase.execute();

    expect(result).toEqual({
      ok: true,
      value: SKILLS.map((skill) => ({
        code: skill.code,
        label: skill.label,
        learningTopics: skill.learningTopics,
      })),
    });
  });
});
