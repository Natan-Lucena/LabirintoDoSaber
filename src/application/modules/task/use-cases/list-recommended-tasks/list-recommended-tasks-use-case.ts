import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { Task, TaskCategory } from "../../../../../domain/entities/task";
import { TaskNotebookSession } from "../../../../../domain/entities/task-notebook-session";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { TaskSkillRepository } from "../../../../../domain/repositories/task-skill-repository";
import { truncateText } from "../../../../../domain/utils/text";
import { mapTaskSummary } from "../../../../../infraestructure/mappers/map-task";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { compareNewestFirst } from "../list-task-catalog/list-task-catalog-use-case";

export interface ListRecommendedTasksUseCaseRequest {
  educatorId: Uuid;
  studentId: string;
}

export const RECOMMENDED_MAX = 6;
export const REASON_MAX = 120;
const ACCURACY_SESSIONS = 5;
const RECENT_SESSIONS = 3;

const CATEGORY_LABEL: Record<TaskCategory, string> = {
  [TaskCategory.Reading]: "leitura",
  [TaskCategory.Writing]: "escrita",
  [TaskCategory.Vocabulary]: "vocabulário",
  [TaskCategory.Comprehension]: "compreensão",
};
const CATEGORY_ORDER = Object.values(TaskCategory);

// AT-08: recomendação por regra, sem IA. Pontua as tarefas (biblioteca + do
// educador) pelas habilidades ligadas às learningTopics do aluno e pela
// categoria de menor acerto nas últimas 5 sessões; tira as respondidas nas 3
// últimas sessões.
export class ListRecommendedTasksUseCase {
  constructor(
    private studentAccess: StudentAccessService,
    private sessionRepository: TaskNotebookSessionRepository,
    private taskRepository: TaskRepository,
    private skillRepository: TaskSkillRepository
  ) {}

  async execute(request: ListRecommendedTasksUseCaseRequest) {
    if (!Uuid.isValid(request.studentId)) return failure("STUDENT_NOT_FOUND" as const);

    // Dono ou compartilhado (EQ-11).
    const access = await this.studentAccess.assertStudentAccess(
      new Uuid(request.studentId),
      request.educatorId
    );
    if (!access.ok) return access;
    const student = access.value;

    const [skills, sessions] = await Promise.all([
      this.skillRepository.listAll(),
      this.sessionRepository.listByStudentId(student.id),
    ]);
    const skillsByCode = new Map(skills.map((skill) => [skill.code, skill]));
    const topicSkills = new Set(
      skills.filter((skill) => skill.matchesAnyTopic(student.learningTopics)).map((s) => s.code)
    );

    const recentFirst = [...sessions].sort(
      (a, b) => b.startedAt.getTime() - a.startedAt.getTime()
    );
    const weakest = await this.weakestCategory(recentFirst.slice(0, ACCURACY_SESSIONS));
    const answeredRecently = new Set(
      recentFirst
        .slice(0, RECENT_SESSIONS)
        .flatMap((session) => session.answers.map((answer) => answer.taskId.value))
    );

    if (topicSkills.size === 0 && !weakest) return success([]);

    const [library, own] = await Promise.all([
      this.taskRepository.listLibrary(),
      this.taskRepository.listByEducator(request.educatorId),
    ]);

    const ranked = [...library, ...own]
      .filter((task) => !answeredRecently.has(task.id.value))
      .map((task) => {
        const skillMatches = task.skills.filter((code) => topicSkills.has(code));
        const categoryMatch = task.category === weakest;
        return { task, skillMatches, categoryMatch };
      })
      .filter((entry) => entry.skillMatches.length > 0 || entry.categoryMatch)
      .sort(
        (a, b) =>
          score(b) - score(a) || compareNewestFirst(a.task, b.task)
      )
      .slice(0, RECOMMENDED_MAX);

    return success(
      ranked.map(({ task, skillMatches, categoryMatch }) => ({
        ...mapTaskSummary(task, skillsByCode),
        reason: reasonFor(
          skillMatches.map((code) => skillsByCode.get(code)!.label),
          categoryMatch ? weakest : undefined
        ),
      }))
    );
  }

  // Categoria com menor acerto; empate fica com a que tem mais respostas e
  // depois com a ordem do enum.
  private async weakestCategory(sessions: TaskNotebookSession[]) {
    const answers = sessions.flatMap((session) => session.answers);
    if (answers.length === 0) return undefined;

    const tasks = await this.taskRepository.getByIds(answers.map((answer) => answer.taskId));
    const categoryById = new Map(tasks.map((task) => [task.id.value, task.category]));

    const totals = new Map<TaskCategory, { total: number; correct: number }>();
    for (const answer of answers) {
      const category = categoryById.get(answer.taskId.value);
      if (!category) continue;
      const current = totals.get(category) ?? { total: 0, correct: 0 };
      totals.set(category, {
        total: current.total + 1,
        correct: current.correct + (answer.isCorrect ? 1 : 0),
      });
    }

    return [...totals.entries()]
      .map(([category, { total, correct }]) => ({ category, total, accuracy: correct / total }))
      .sort(
        (a, b) =>
          a.accuracy - b.accuracy ||
          b.total - a.total ||
          CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)
      )[0]?.category;
  }
}

const score = (entry: { skillMatches: string[]; categoryMatch: boolean }) =>
  entry.skillMatches.length + (entry.categoryMatch ? 2 : 0);

// Texto curto, sem dado do aluno.
function reasonFor(skillLabels: string[], weakest?: TaskCategory): string {
  const skills = skillLabels.slice(0, 2).join(" e ");
  const category = weakest
    ? `${CATEGORY_LABEL[weakest]}, a categoria com menor acerto nas últimas sessões`
    : undefined;

  const text =
    skills && category
      ? `Trabalha ${skills} e reforça ${category}.`
      : skills
        ? `Trabalha ${skills}, ligada aos temas de aprendizagem do paciente.`
        : `Reforça ${category}.`;

  return truncateText(text, REASON_MAX);
}
