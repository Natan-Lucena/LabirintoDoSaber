import { Uuid } from "@wave-telecom/framework/core";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { loadAuthorNames } from "../../../../services/author-names";
import { mapStudentListItem, matchesStatus, StudentStatusFilter } from "../student-list-item";

interface ListStudentsByEducatorRequest {
  educatorId: Uuid;
  // PA-03: padrão ACTIVE (o arquivado sai da lista).
  status?: StudentStatusFilter;
}

// EQ-13: os pacientes do educador e os compartilhados com ele. O ADMIN não vê
// paciente que não foi compartilhado com ele.
export class ListStudentsByEducatorUseCase {
  constructor(
    private studentAccess: StudentAccessService,
    private educatorRepository: EducatorRepository
  ) {}

  async execute(request: ListStudentsByEducatorRequest) {
    const status = request.status ?? "ACTIVE";
    const students = (await this.studentAccess.listAccessibleStudents(request.educatorId)).filter(
      ({ student }) => matchesStatus(student, status)
    );

    // Nome dos donos dos compartilhados, numa consulta só.
    const ownerNames = await loadAuthorNames(
      this.educatorRepository,
      students.map(({ student }) => student.educatorId),
      request.educatorId
    );

    return students.map(({ student, access }) =>
      mapStudentListItem(student, access, ownerNames.get(student.educatorId.value))
    );
  }
}
