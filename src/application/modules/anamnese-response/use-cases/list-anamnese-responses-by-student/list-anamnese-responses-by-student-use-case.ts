import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";

interface ListAnamneseResponsesByStudentUseCaseRequest {
  educatorId: Uuid;
  studentId: string;
}

export class ListAnamneseResponsesByStudentUseCase {
  constructor(
    private responseRepository: AnamneseResponseRepository,
    private studentAccess: StudentAccessService
  ) {}

  // Só quem acessa o aluno, dono ou compartilhado (EQ-11). Traz as respostas
  // de todos os autores.
  async execute(request: ListAnamneseResponsesByStudentUseCaseRequest) {
    if (!Uuid.isValid(request.studentId)) return failure("STUDENT_NOT_FOUND");

    const access = await this.studentAccess.assertStudentAccess(
      new Uuid(request.studentId),
      request.educatorId
    );
    if (!access.ok) return access;

    const responses = await this.responseRepository.listByStudentId(access.value.id);
    return success(responses);
  }
}
