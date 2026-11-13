import { failure, success, Uuid } from "@wave-telecom/framework/core";
import {
  Report,
  ReportAudience,
  ReportSection,
  ReportType,
} from "../../../../../domain/entities/report";
import { ReportRepository } from "../../../../../domain/repositories/report-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { AiClinicalService } from "../../../../../domain/services/ai-clinical-service";
import { callClinicalAi, clipAiText } from "../../../../services/clinical-ai-call";
import { assertStudentOwnership } from "../../../plan/use-cases/plan-access";
import {
  assembleReportContent,
  buildSynthesisParams,
  isEmptyPeriod,
  ReportContentBuilder,
} from "../../report-content-builder";

const SYNTHESIS_MAX = 2500;

export interface CreateReportUseCaseRequest {
  educatorId: Uuid;
  // Do educador do token: nome e profissão vão ao documento.
  professional: { name: string; profession?: string };
  studentId: string;
  type: ReportType;
  audience: ReportAudience;
  period: { from: string; to: string };
  sections: ReportSection[];
}

export class CreateReportUseCase {
  constructor(
    private reportRepository: ReportRepository,
    private studentRepository: StudentRepository,
    private contentBuilder: ReportContentBuilder,
    private aiClinicalService: AiClinicalService
  ) {}

  async execute(request: CreateReportUseCaseRequest) {
    const { period } = request;

    // RP-04, antes de qualquer consulta.
    const sections = Report.validateRequest({
      type: request.type,
      sections: request.sections,
      periodFrom: period.from,
      periodTo: period.to,
    });
    if (!sections.ok) return sections;

    const ownership = await assertStudentOwnership(
      this.studentRepository,
      new Uuid(request.studentId),
      request.educatorId
    );
    if (!ownership.ok) return ownership;
    const student = ownership.value;

    const data = await this.contentBuilder.load(student, period);
    if (!data.ok) return data;
    if (isEmptyPeriod(data.value, sections.value)) return failure("REPORT_EMPTY_PERIOD");

    // Um único instante para content.generatedAt e createdAt.
    const now = new Date();

    const content = assembleReportContent({
      data: data.value,
      type: request.type,
      sections: sections.value,
      student,
      professional: request.professional,
      generatedAt: now,
    });

    // RP-06: a síntese é opcional; se a IA falhar, o relatório sai sem ela.
    let synthesisFailed = false;
    if (sections.value.includes(ReportSection.AI_SYNTHESIS)) {
      const params = buildSynthesisParams({
        content,
        student,
        audience: request.audience,
        type: request.type,
        period,
      });
      const output = await callClinicalAi("create-report-synthesis", () =>
        this.aiClinicalService.reportSynthesis(params)
      );
      const text = output.ok ? clipAiText(output.value?.text, SYNTHESIS_MAX) : "";
      if (text) {
        content.synthesis = text;
      } else {
        synthesisFailed = true;
      }
    }

    const report = Report.create({
      studentId: student.id,
      studentName: student.name,
      educatorId: request.educatorId,
      type: request.type,
      audience: request.audience,
      periodFrom: period.from,
      periodTo: period.to,
      sections: sections.value,
      content,
      synthesisFailed,
      createdAt: now,
    });
    if (!report.ok) return report;

    await this.reportRepository.save(report.value);

    return success(report.value);
  }
}
