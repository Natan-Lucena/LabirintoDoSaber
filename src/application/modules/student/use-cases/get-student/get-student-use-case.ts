import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { loadAuthorNames } from "../../../../services/author-names";
import { mapStudentListItem } from "../student-list-item";
import { parseStudentId } from "../student-share-list";

export interface GetStudentUseCaseRequest {
  educatorId: Uuid;
  studentId: string;
}

// PP-09: o aluno no formato de GET /student/, para quem o lê (dono ou
// compartilhado). Arquivado continua legível (PA-03).
export class GetStudentUseCase {
  constructor(
    private studentAccess: StudentAccessService,
    private educatorRepository: EducatorRepository
  ) {}

  async execute(request: GetStudentUseCaseRequest) {
    const studentId = parseStudentId(request.studentId);
    if (!studentId) return failure("STUDENT_NOT_FOUND");

    const access = await this.studentAccess.assertStudentAccess(studentId, request.educatorId);
    if (!access.ok) return access;
    const student = access.value;

    const accessKind =
      student.educatorId.value === request.educatorId.value ? "OWNER" : "SHARED";
    const ownerNames = await loadAuthorNames(
      this.educatorRepository,
      [student.educatorId],
      request.educatorId
    );

    return success(
      mapStudentListItem(student, accessKind, ownerNames.get(student.educatorId.value))
    );
  }
}
