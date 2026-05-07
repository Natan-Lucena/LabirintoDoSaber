import { Uuid } from "@wave-telecom/framework/core";
import { TaskCategory } from "./task";

export interface CategoryAccuracyData {
  category: TaskCategory;
  total: number;
  correct: number;
  accuracy: number;
}

export interface StudentAnalysisReportProps {
  id?: string;
  studentId: string;
  generatedAt?: Date;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  sessionIds: string[];
  categories: CategoryAccuracyData[];
  totalQuestions: number;
  totalCorrect: number;
  accuracy: number;
}

export class StudentAnalysisReport {
  public readonly id: Uuid;
  public readonly studentId: Uuid;
  public readonly generatedAt: Date;
  public readonly startDate?: Date;
  public readonly endDate?: Date;
  public readonly limit?: number;
  public readonly sessionIds: string[];
  public readonly categories: CategoryAccuracyData[];
  public readonly totalQuestions: number;
  public readonly totalCorrect: number;
  public readonly accuracy: number;

  constructor(props: Required<Omit<StudentAnalysisReportProps, 'startDate' | 'endDate' | 'limit'>> & Pick<StudentAnalysisReportProps, 'startDate' | 'endDate' | 'limit'> & { id: string; generatedAt: Date }) {
    this.id = new Uuid(props.id);
    this.studentId = new Uuid(props.studentId);
    this.generatedAt = props.generatedAt;
    this.startDate = props.startDate;
    this.endDate = props.endDate;
    this.limit = props.limit;
    this.sessionIds = props.sessionIds;
    this.categories = props.categories;
    this.totalQuestions = props.totalQuestions;
    this.totalCorrect = props.totalCorrect;
    this.accuracy = props.accuracy;
  }

  static create(props: StudentAnalysisReportProps): StudentAnalysisReport {
    return new StudentAnalysisReport({
      id: props.id ?? Uuid.random().value,
      studentId: props.studentId,
      generatedAt: props.generatedAt ?? new Date(),
      startDate: props.startDate,
      endDate: props.endDate,
      limit: props.limit,
      sessionIds: props.sessionIds,
      categories: props.categories,
      totalQuestions: props.totalQuestions,
      totalCorrect: props.totalCorrect,
      accuracy: props.accuracy,
    });
  }
}
