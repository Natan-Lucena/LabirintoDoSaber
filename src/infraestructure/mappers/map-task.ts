import { Task } from "../../domain/entities/task";
import { TaskSkill } from "../../domain/entities/task-skill";

// TaskSummary do catálogo e da recomendação. Códigos que saíram do catálogo
// de habilidades não aparecem.
export const mapTaskSummary = (task: Task, skillsByCode: Map<string, TaskSkill>) => ({
  id: task.id.value,
  type: task.type,
  format: task.format,
  source: task.source,
  category: task.category,
  title: task.title,
  skills: task.skills.flatMap((code) => {
    const skill = skillsByCode.get(code);
    return skill ? [{ code: skill.code, label: skill.label }] : [];
  }),
  ...(task.theme ? { theme: task.theme } : {}),
  tone: task.tone,
  ...(task.thumbnailUrl ? { thumbnailUrl: task.thumbnailUrl } : {}),
});

export type TaskSummaryResponse = ReturnType<typeof mapTaskSummary>;
