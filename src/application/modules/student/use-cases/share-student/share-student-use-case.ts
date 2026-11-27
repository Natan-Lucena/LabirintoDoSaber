import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { StudentShare } from "../../../../../domain/entities/student-share";
import { ClinicMemberRepository } from "../../../../../domain/repositories/clinic-member-repository";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { StudentShareRepository } from "../../../../../domain/repositories/student-share-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { loadStudentShares, parseStudentId } from "../student-share-list";

export interface ShareStudentUseCaseRequest {
  educatorId: Uuid;
  studentId: string;
  targetEducatorId: string;
}

// EQ-10: só o dono compartilha, só com membro da mesma clínica. Repetir é
// idempotente.
export class ShareStudentUseCase {
  constructor(
    private studentAccess: StudentAccessService,
    private shareRepository: StudentShareRepository,
    private memberRepository: ClinicMemberRepository,
    private educatorRepository: EducatorRepository
  ) {}

  async execute(request: ShareStudentUseCaseRequest) {
    const studentId = parseStudentId(request.studentId);
    if (!studentId) return failure("STUDENT_NOT_FOUND");

    const access = await this.studentAccess.assertStudentAccess(studentId, request.educatorId, {
      mode: "owner",
    });
    if (!access.ok) return access;
    const student = access.value;

    // O dono já tem acesso: não há o que compartilhar.
    if (request.targetEducatorId !== request.educatorId.value) {
      const sameClinic = await this.isInSameClinic(request.educatorId, request.targetEducatorId);
      if (!sameClinic) return failure("NOT_IN_SAME_CLINIC");

      await this.shareRepository.create(
        StudentShare.create({
          studentId: student.id,
          educatorId: new Uuid(request.targetEducatorId),
          sharedBy: request.educatorId,
        })
      );
    }

    return success(await loadStudentShares(this.listDeps(), student));
  }

  private async isInSameClinic(ownerId: Uuid, targetEducatorId: string) {
    if (!Uuid.isValid(targetEducatorId)) return false;

    const [ownerMember, targetMember] = await Promise.all([
      this.memberRepository.findByEducatorId(ownerId),
      this.memberRepository.findByEducatorId(new Uuid(targetEducatorId)),
    ]);
    return (
      !!ownerMember &&
      !!targetMember &&
      ownerMember.clinicId.value === targetMember.clinicId.value
    );
  }

  private listDeps() {
    return {
      shareRepository: this.shareRepository,
      memberRepository: this.memberRepository,
      educatorRepository: this.educatorRepository,
    };
  }
}
