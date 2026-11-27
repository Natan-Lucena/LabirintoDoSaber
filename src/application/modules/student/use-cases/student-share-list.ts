import { Uuid } from "@wave-telecom/framework/core";
import { TeamRole } from "../../../../domain/entities/clinic";
import { Student } from "../../../../domain/entities/student";
import { ClinicMemberRepository } from "../../../../domain/repositories/clinic-member-repository";
import { EducatorRepository } from "../../../../domain/repositories/educator-repository";
import { StudentShareRepository } from "../../../../domain/repositories/student-share-repository";

export interface StudentShareView {
  educatorId: string;
  name: string;
  // Ausente se o educador não é mais membro da clínica do dono.
  role?: TeamRole;
  sharedAt: Date;
}

export interface StudentShareListDeps {
  shareRepository: StudentShareRepository;
  memberRepository: ClinicMemberRepository;
  educatorRepository: EducatorRepository;
}

// Resposta das três rotas de compartilhamento: StudentShare[] com nome e
// papel, em lote (compartilhamentos, educadores e membros da clínica do dono).
export async function loadStudentShares(
  deps: StudentShareListDeps,
  student: Student
): Promise<StudentShareView[]> {
  const shares = await deps.shareRepository.listByStudentId(student.id);
  if (shares.length === 0) return [];

  const [educators, ownerMember] = await Promise.all([
    deps.educatorRepository.getByIds(shares.map((share) => share.educatorId)),
    deps.memberRepository.findByEducatorId(student.educatorId),
  ]);
  const members = ownerMember
    ? await deps.memberRepository.listByClinicId(ownerMember.clinicId)
    : [];

  const names = new Map(educators.map((educator) => [educator.id.value, educator.name]));
  const roles = new Map(members.map((member) => [member.educatorId.value, member.role]));

  return shares
    .filter((share) => names.has(share.educatorId.value))
    .map((share) => {
      const role = roles.get(share.educatorId.value);
      return {
        educatorId: share.educatorId.value,
        name: names.get(share.educatorId.value)!,
        ...(role ? { role } : {}),
        sharedAt: share.sharedAt,
      };
    });
}

// Id de aluno que não é UUID vira 404, não 500 (§1).
export const parseStudentId = (studentId: string) =>
  Uuid.isValid(studentId) ? new Uuid(studentId) : undefined;
