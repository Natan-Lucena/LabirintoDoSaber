import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { Task, TaskCategory } from "../../../../../domain/entities/task";
import { TaskNotebookSession } from "../../../../../domain/entities/task-notebook-session";
import { Student } from "../../../../../domain/entities/student";

export interface GenerateStudentAnalysisUseCaseRequest {
  studentId: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}

export interface CategoryAccuracyResult {
  category: TaskCategory;
  total: number;
  correct: number;
  accuracy: number;
}

export interface StudentAnalysisResponse {
  categories: Record<TaskCategory, CategoryAccuracyResult>;
  total: {
    total: number;
    correct: number;
    accuracy: number;
  };
  sessions: TaskNotebookSession[];
}

// Dados internos que outros use cases (ex: GenerateStudentAiAnalysisUseCase)
// podem reaproveitar sem refazer as mesmas buscas no banco. NÃO é exposto
// via HTTP em lugar nenhum — o controller usa apenas o retorno de execute().
export interface StudentAnalysisRawData {
  student: Student;
  sessions: TaskNotebookSession[];
  taskById: Map<string, Task>;
  categories: Record<TaskCategory, CategoryAccuracyResult>;
  total: {
    total: number;
    correct: number;
    accuracy: number;
  };
}

const emptyCategories = (): Record<TaskCategory, CategoryAccuracyResult> => ({
  [TaskCategory.Reading]: {
    category: TaskCategory.Reading,
    total: 0,
    correct: 0,
    accuracy: 0,
  },
  [TaskCategory.Writing]: {
    category: TaskCategory.Writing,
    total: 0,
    correct: 0,
    accuracy: 0,
  },
  [TaskCategory.Vocabulary]: {
    category: TaskCategory.Vocabulary,
    total: 0,
    correct: 0,
    accuracy: 0,
  },
  [TaskCategory.Comprehension]: {
    category: TaskCategory.Comprehension,
    total: 0,
    correct: 0,
    accuracy: 0,
  },
});

export class GenerateStudentAnalysisUseCase {
  constructor(
    private studentRepository: StudentRepository,
    private taskNotebookSessionRepository: TaskNotebookSessionRepository,
    private taskRepository: TaskRepository,
  ) {}

  async execute(request: GenerateStudentAnalysisUseCaseRequest) {
    const raw = await this.loadAnalysisData(request);
    if (!raw.ok) return raw;

    const { categories, total, sessions } = raw.value;
    return success<StudentAnalysisResponse>({ categories, total, sessions });
  }

  // Faz todo o trabalho de busca/agregação e expõe também o Student e o
  // Map de tasks já resolvidos, para quem precisar deles sem refazer as
  // mesmas queries (ex: montar o prompt da análise por IA).
  async loadAnalysisData(request: GenerateStudentAnalysisUseCaseRequest) {
    const student = await this.studentRepository.getById(
      new Uuid(request.studentId),
    );

    if (!student) {
      return failure("STUDENT_NOT_FOUND");
    }

    const allSessions = await this.taskNotebookSessionRepository.listByStudentId(
      new Uuid(request.studentId),
    );

    let sessions = allSessions;

    if (request.limit) {
      sessions = [...allSessions]
        .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
        .slice(0, request.limit);
    } else if (request.startDate || request.endDate) {
      sessions = allSessions.filter((session) => {
        if (request.startDate && session.startedAt < request.startDate)
          return false;
        if (request.endDate && session.startedAt > request.endDate)
          return false;
        return true;
      });
    }

    if (!sessions.length) {
      return success<StudentAnalysisRawData>({
        student,
        sessions: [],
        taskById: new Map(),
        categories: emptyCategories(),
        total: { total: 0, correct: 0, accuracy: 0 },
      });
    }

    const categoryStats: Record<
      TaskCategory,
      { total: number; correct: number }
    > = {
      [TaskCategory.Reading]: { total: 0, correct: 0 },
      [TaskCategory.Writing]: { total: 0, correct: 0 },
      [TaskCategory.Vocabulary]: { total: 0, correct: 0 },
      [TaskCategory.Comprehension]: { total: 0, correct: 0 },
    };

    let totalAnswered = 0;
    let totalCorrect = 0;

    const uniqueTaskIds = new Map<string, Uuid>();
    for (const session of sessions) {
      for (const answer of session.answers) {
        uniqueTaskIds.set(answer.taskId.value, answer.taskId);
      }
    }

    const tasks = await this.taskRepository.getByIds(
      Array.from(uniqueTaskIds.values()),
    );
    const taskById = new Map(tasks.map((task) => [task.id.value, task]));

    for (const session of sessions) {
      for (const answer of session.answers) {
        const task = taskById.get(answer.taskId.value);
        if (!task) continue;

        const category = task.category;

        categoryStats[category].total++;
        totalAnswered++;

        if (answer.isCorrect) {
          categoryStats[category].correct++;
          totalCorrect++;
        }
      }
    }

    const categories: Record<TaskCategory, CategoryAccuracyResult> = {
      [TaskCategory.Reading]: {
        category: TaskCategory.Reading,
        total: categoryStats[TaskCategory.Reading].total,
        correct: categoryStats[TaskCategory.Reading].correct,
        accuracy:
          categoryStats[TaskCategory.Reading].total === 0
            ? 0
            : categoryStats[TaskCategory.Reading].correct /
              categoryStats[TaskCategory.Reading].total,
      },
      [TaskCategory.Writing]: {
        category: TaskCategory.Writing,
        total: categoryStats[TaskCategory.Writing].total,
        correct: categoryStats[TaskCategory.Writing].correct,
        accuracy:
          categoryStats[TaskCategory.Writing].total === 0
            ? 0
            : categoryStats[TaskCategory.Writing].correct /
              categoryStats[TaskCategory.Writing].total,
      },
      [TaskCategory.Vocabulary]: {
        category: TaskCategory.Vocabulary,
        total: categoryStats[TaskCategory.Vocabulary].total,
        correct: categoryStats[TaskCategory.Vocabulary].correct,
        accuracy:
          categoryStats[TaskCategory.Vocabulary].total === 0
            ? 0
            : categoryStats[TaskCategory.Vocabulary].correct /
              categoryStats[TaskCategory.Vocabulary].total,
      },
      [TaskCategory.Comprehension]: {
        category: TaskCategory.Comprehension,
        total: categoryStats[TaskCategory.Comprehension].total,
        correct: categoryStats[TaskCategory.Comprehension].correct,
        accuracy:
          categoryStats[TaskCategory.Comprehension].total === 0
            ? 0
            : categoryStats[TaskCategory.Comprehension].correct /
              categoryStats[TaskCategory.Comprehension].total,
      },
    };

    return success<StudentAnalysisRawData>({
      student,
      sessions,
      taskById,
      categories,
      total: {
        total: totalAnswered,
        correct: totalCorrect,
        accuracy: totalAnswered === 0 ? 0 : totalCorrect / totalAnswered,
      },
    });
  }
}
