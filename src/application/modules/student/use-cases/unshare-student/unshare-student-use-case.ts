import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { ClinicMemberRepository } from "../../../../../domain/repositories/clinic-member-repository";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { StudentShareRepository } from "../../../../../domain/repositories/student-share-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { loadStudentShares, parseStudentId } from "../student-share-list";

export interface UnshareStudentUseCaseRequest {
  educatorId: Uuid;
  studentId: string;
  targetEducatorId: string;
}

// EQ-10: só o dono desfaz o compartilhamento.
export class UnshareStudentUseCase {
  constructor(
    private studentAccess: StudentAccessService,
    private shareRepository: StudentShareRepository,
    private memberRepository: ClinicMemberRepository,
    private educatorRepository: EducatorRepository
  ) {}

  async execute(request: UnshareStudentUseCaseRequest) {
    const studentId = parseStudentId(request.studentId);
    if (!studentId) return failure("STUDENT_NOT_FOUND");

    const access = await this.studentAccess.assertStudentAccess(studentId, request.educatorId, {
      mode: "owner",
    });
    if (!access.ok) return access;
    const student = access.value;

    if (!Uuid.isValid(request.targetEducatorId)) return failure("SHARE_NOT_FOUND");
    const targetId = new Uuid(request.targetEducatorId);

    const share = await this.shareRepository.find(student.id, targetId);
    if (!share) return failure("SHARE_NOT_FOUND");

    await this.shareRepository.delete(student.id, targetId);

    return success(await loadStudentShares(this.listDeps(), student));
  }

  private listDeps() {
    return {
      shareRepository: this.shareRepository,
      memberRepository: this.memberRepository,
      educatorRepository: this.educatorRepository,
    };
  }
}
