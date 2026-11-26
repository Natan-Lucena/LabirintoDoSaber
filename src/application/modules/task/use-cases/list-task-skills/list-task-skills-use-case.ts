import { success } from "@wave-telecom/framework/core";
import { TaskSkillRepository } from "../../../../../domain/repositories/task-skill-repository";

// AT-12: catálogo fixo de habilidades, na ordem do seed.
export class ListTaskSkillsUseCase {
  constructor(private skillRepository: TaskSkillRepository) {}

  async execute() {
    const skills = await this.skillRepository.listAll();
    return success(skills.map((skill) => skill.toJSON()));
  }
}
