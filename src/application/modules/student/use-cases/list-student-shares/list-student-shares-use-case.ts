import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { ClinicMemberRepository } from "../../../../../domain/repositories/clinic-member-repository";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { StudentShareRepository } from "../../../../../domain/repositories/student-share-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { loadStudentShares, parseStudentId } from "../student-share-list";

export interface ListStudentSharesUseCaseRequest {
  educatorId: Uuid;
  studentId: string;
}

// Lê quem pode ler o paciente (dono ou compartilhado); gerenciar é só do dono.
export class ListStudentSharesUseCase {
  constructor(
    private studentAccess: StudentAccessService,
    private shareRepository: StudentShareRepository,
    private memberRepository: ClinicMemberRepository,
    private educatorRepository: EducatorRepository
  ) {}

  async execute(request: ListStudentSharesUseCaseRequest) {
    const studentId = parseStudentId(request.studentId);
    if (!studentId) return failure("STUDENT_NOT_FOUND");

    const access = await this.studentAccess.assertStudentAccess(studentId, request.educatorId);
    if (!access.ok) return access;

    return success(await loadStudentShares(this.listDeps(), access.value));
  }

  private listDeps() {
    return {
      shareRepository: this.shareRepository,
      memberRepository: this.memberRepository,
      educatorRepository: this.educatorRepository,
    };
  }
}
