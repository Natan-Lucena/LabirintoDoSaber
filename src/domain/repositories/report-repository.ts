import { Uuid } from "@wave-telecom/framework/core";
import { Report, ReportShare, ReportSummaryProps } from "../entities/report";

export interface SearchReportParams {
  // Alunos cujo dono atual é o educador; o autor gravado no relatório não entra.
  studentIds: Uuid[];
  limit: number;
}

export interface ReportRepository {
  // Grava o relatório na criação; o conteúdo não muda depois (RP-03).
  save(report: Report): Promise<void>;
  // Acrescenta um envio sem regravar a lista nem o conteúdo.
  addShare(id: Uuid, share: ReportShare): Promise<void>;
  findById(id: Uuid): Promise<Report | null>;
  // Sem o conteúdo, mais recentes primeiro.
  search(params: SearchReportParams): Promise<ReportSummaryProps[]>;
  // Não falha se o relatório já foi excluído.
  delete(id: Uuid): Promise<void>;
}
