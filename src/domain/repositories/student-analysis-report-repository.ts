import { Uuid } from "@wave-telecom/framework/core";
import { StudentAnalysisReport } from "../entities/student-analysis-report";

export interface StudentAnalysisReportRepository {
  save(report: StudentAnalysisReport): Promise<void>;
  listByStudentId(studentId: Uuid): Promise<StudentAnalysisReport[]>;
}
