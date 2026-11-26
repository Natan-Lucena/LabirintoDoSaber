import { success, Uuid } from "@wave-telecom/framework/core";
import { ApplicationStatus } from "../../../../../domain/entities/scale-application";
import { Student } from "../../../../../domain/entities/student";
import { ScaleApplicationRepository } from "../../../../../domain/repositories/scale-application-repository";
import { ScaleTemplateRepository } from "../../../../../domain/repositories/scale-template-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { mapScaleApplicationToSummary } from "../../../../../infraestructure/mappers/map-scale";

export interface ListScaleApplicationsUseCaseRequest {
  educatorId: Uuid;
  studentId?: string;
  status?: ApplicationStatus;
  limit: number;
}

export class ListScaleApplicationsUseCase {
  constructor(
    private applicationRepository: ScaleApplicationRepository,
    private templateRepository: ScaleTemplateRepository,
    private studentAccess: StudentAccessService
  ) {}

  // Filtra pelos alunos que o educador acessa, dono ou compartilhado (AV-01,
  // EQ-11), não pelo autor gravado.
  async execute(request: ListScaleApplicationsUseCaseRequest) {
    let students: Student[];

    if (request.studentId) {
      const access = await this.studentAccess.assertStudentAccess(
        new Uuid(request.studentId),
        request.educatorId
      );
      if (!access.ok) return access;
      students = [access.value];
    } else {
      const accessible = await this.studentAccess.listAccessibleStudents(request.educatorId);
      students = accessible.map(({ student }) => student);
    }

    const applications = await this.applicationRepository.search({
      studentIds: students.map((student) => student.id),
      status: request.status,
      limit: request.limit,
    });

    // Templates das versões usadas, em lote, para o escore de cada resumo.
    const templateIds = [
      ...new Set(applications.map((application) => application.templateId.value)),
    ];
    const templates = await this.templateRepository.findByIds(
      templateIds.map((id) => new Uuid(id))
    );
    const templateById = new Map(templates.map((template) => [template.id.value, template]));
    const studentNames = new Map(students.map((student) => [student.id.value, student.name]));

    return success(
      applications.flatMap((application) => {
        const template = templateById.get(application.templateId.value);
        // Versão gravada sempre existe (versão publicada não é apagada).
        if (!template) return [];
        return [
          mapScaleApplicationToSummary(
            application,
            template,
            studentNames.get(application.studentId.value) ?? ""
          ),
        ];
      })
    );
  }
}
