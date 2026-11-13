import { Uuid } from "@wave-telecom/framework/core";
import { Report, ReportSummaryProps } from "../entities/report";

export interface SearchReportParams {
  // Alunos cujo dono atual é o educador; o autor gravado no relatório não entra.
  studentIds: Uuid[];
  limit: number;
}

export interface ReportRepository {
  save(report: Report): Promise<void>;
  findById(id: Uuid): Promise<Report | null>;
  // Sem o conteúdo, mais recentes primeiro.
  search(params: SearchReportParams): Promise<ReportSummaryProps[]>;
  delete(id: Uuid): Promise<void>;
}
