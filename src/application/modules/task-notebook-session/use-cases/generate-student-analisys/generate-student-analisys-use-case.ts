import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { TaskRepository } from "../../../../../domain/repositories/task-repository";
import { TaskCategory } from "../../../../../domain/entities/task";
import { TaskNotebookSession } from "../../../../../domain/entities/task-notebook-session";

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

export class GenerateStudentAnalysisUseCase {
  constructor(
    private studentRepository: StudentRepository,
    private taskNotebookSessionRepository: TaskNotebookSessionRepository,
    private taskRepository: TaskRepository,
  ) {}

  async execute(request: GenerateStudentAnalysisUseCaseRequest) {
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
      return success({
        categories: {
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
        },
        total: { total: 0, correct: 0, accuracy: 0 },
        sessions: [],
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

    for (const session of sessions) {
      for (const answer of session.answers) {
        const task = await this.taskRepository.getById(answer.taskId);
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

    const response: StudentAnalysisResponse = {
      categories: {
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
      },
      total: {
        total: totalAnswered,
        correct: totalCorrect,
        accuracy: totalAnswered === 0 ? 0 : totalCorrect / totalAnswered,
      },
      sessions: sessions,
    };

    return success(response);
  }
}
