import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { AnamneseResponseRepository } from "../../../../domain/repositories/anamnese-response-repository";
import { StudentAccessService } from "../../../../domain/services/student-access-service";

// O acesso é pelo aluno da resposta, dono ou compartilhado (EQ-11), não pelo
// educatorId gravado (que continua sendo o de quem criou).
export async function loadAccessibleResponse(
  responseRepository: AnamneseResponseRepository,
  studentAccess: StudentAccessService,
  responseId: string,
  educatorId: Uuid
) {
  // Id que não é UUID vira 404, não 500.
  if (!Uuid.isValid(responseId)) return failure("RESPONSE_NOT_FOUND");

  const response = await responseRepository.findById(new Uuid(responseId));
  if (!response) return failure("RESPONSE_NOT_FOUND");

  const access = await studentAccess.assertStudentAccess(response.studentId, educatorId);
  if (!access.ok) return access;

  return success({ response, student: access.value });
}
