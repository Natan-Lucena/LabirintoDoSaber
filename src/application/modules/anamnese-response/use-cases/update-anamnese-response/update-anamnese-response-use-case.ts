import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { AnamneseTemplateRepository } from "../../../../../domain/repositories/anamnese-template-repository";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";
import { AnamneseAnswerInput } from "../../../../../domain/entities/anamnese-response";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { loadAccessibleResponse } from "../response-access";

interface UpdateAnamneseResponseUseCaseRequest {
  responseId: string;
  educatorId: Uuid;
  answers: AnamneseAnswerInput[];
}

export class UpdateAnamneseResponseUseCase {
  constructor(
    private templateRepository: AnamneseTemplateRepository,
    private responseRepository: AnamneseResponseRepository,
    private studentAccess: StudentAccessService
  ) {}

  async execute(request: UpdateAnamneseResponseUseCaseRequest) {
    const access = await loadAccessibleResponse(
      this.responseRepository,
      this.studentAccess,
      request.responseId,
      request.educatorId
    );
    if (!access.ok) return access;
    const { response } = access.value;

    const template = await this.templateRepository.findById(response.templateId);
    if (!template) {
      return failure("TEMPLATE_NOT_FOUND");
    }

    const updated = response.updateAnswers(request.answers, template);
    if (!updated.ok) {
      return updated;
    }

    await this.responseRepository.save(updated.value);
    return success(updated.value);
  }
}
