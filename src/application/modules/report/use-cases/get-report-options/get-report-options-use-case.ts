import { success } from "@wave-telecom/framework/core";
import { REPORT_OPTIONS } from "../../../../../domain/services/report-options";

// Opções estáticas do formulário de relatório (§6.2).
export class GetReportOptionsUseCase {
  execute() {
    return success(REPORT_OPTIONS);
  }
}
