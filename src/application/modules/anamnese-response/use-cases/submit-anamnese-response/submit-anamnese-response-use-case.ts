import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { AnamneseTemplateRepository } from "../../../../../domain/repositories/anamnese-template-repository";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
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
    private studentRepository: StudentRepository
  ) {}

  async execute(request: SubmitAnamneseResponseUseCaseRequest) {
    const template = await this.templateRepository.findById(
      new Uuid(request.templateId)
    );

    if (!template) {
      return failure("TEMPLATE_NOT_FOUND");
    }

    const student = await this.studentRepository.getById(
      new Uuid(request.studentId)
    );

    if (!student) {
      return failure("STUDENT_NOT_FOUND");
    }

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
