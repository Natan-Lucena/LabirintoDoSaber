import { TaskSkill } from "../entities/task-skill";

export interface TaskSkillRepository {
  // Catálogo inteiro, na ordem de exibição.
  listAll(): Promise<TaskSkill[]>;
  save(skill: TaskSkill): Promise<void>;
}
