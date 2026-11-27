import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { AnamneseTemplateRepository } from "../../../../../domain/repositories/anamnese-template-repository";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { AnamneseResponse, AnamneseAnswerInput } from "../../../../../domain/entities/anamnese-response";

interface SubmitAnamneseResponseUseCaseRequest {
  templateId: string;
  educatorId: Uuid;
  studentId: string;
  answers: AnamneseAnswerInput[];
}

export class SubmitAnamneseResponseUseCase {
  constructor(
    private templateRepository: AnamneseTemplateRepository,
    private responseRepository: AnamneseResponseRepository,
    private studentAccess: StudentAccessService
  ) {}

  async execute(request: SubmitAnamneseResponseUseCaseRequest) {
    const template = await this.templateRepository.findById(
      new Uuid(request.templateId)
    );

    if (!template) {
      return failure("TEMPLATE_NOT_FOUND");
    }

    // Dono ou compartilhado (EQ-11); a resposta grava quem a criou.
    const access = await this.studentAccess.assertStudentAccess(
      new Uuid(request.studentId),
      request.educatorId
    );
    if (!access.ok) return access;
    const student = access.value;

    const response = AnamneseResponse.create(
      {
        templateId: template.id,
        educatorId: request.educatorId,
        studentId: student.id,
        answers: request.answers,
      },
      template
    );

    if (!response.ok) {
      return failure(response.error as string);
    }

    await this.responseRepository.save(response.value);
    return success(response.value);
  }
}
