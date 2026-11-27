import { Uuid } from "@wave-telecom/framework/core";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { mapStudentToResponse } from "../../../../../infraestructure/mappers/map-student";
import { loadAuthorNames } from "../../../../services/author-names";

interface ListStudentsByEducatorRequest {
  educatorId: Uuid;
}

// EQ-13: os pacientes do educador e os compartilhados com ele. O ADMIN não vê
// paciente que não foi compartilhado com ele.
export class ListStudentsByEducatorUseCase {
  constructor(
    private studentAccess: StudentAccessService,
    private educatorRepository: EducatorRepository
  ) {}

  async execute(request: ListStudentsByEducatorRequest) {
    const students = await this.studentAccess.listAccessibleStudents(request.educatorId);

    // Nome dos donos dos compartilhados, numa consulta só.
    const ownerNames = await loadAuthorNames(
      this.educatorRepository,
      students.map(({ student }) => student.educatorId),
      request.educatorId
    );

    return students.map(({ student, access }) => {
      const ownerName = ownerNames.get(student.educatorId.value);
      return {
        ...mapStudentToResponse(student),
        access,
        ...(access === "SHARED" && ownerName ? { ownerName } : {}),
      };
    });
  }
}
