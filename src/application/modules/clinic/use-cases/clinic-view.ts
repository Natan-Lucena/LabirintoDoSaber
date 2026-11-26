import { Uuid } from "@wave-telecom/framework/core";
import { Clinic, TeamRole } from "../../../../domain/entities/clinic";
import { ClinicMember } from "../../../../domain/entities/clinic-member";
import { Educator } from "../../../../domain/entities/educator";
import { ClinicRepository } from "../../../../domain/repositories/clinic-repository";
import { ClinicMemberRepository } from "../../../../domain/repositories/clinic-member-repository";
import { EducatorRepository } from "../../../../domain/repositories/educator-repository";

export interface ClinicMemberEntry {
  member: ClinicMember;
  educator: Educator;
}

export interface ClinicView {
  clinic: Clinic;
  myRole: TeamRole;
  // ADMIN primeiro, depois por nome.
  members: ClinicMemberEntry[];
}

export interface Membership {
  member: ClinicMember;
  clinic: Clinic;
}

// Vínculo do educador com a clínica dele, ou null se não tem clínica.
export async function findMembership(
  memberRepository: ClinicMemberRepository,
  clinicRepository: ClinicRepository,
  educatorId: Uuid
): Promise<Membership | null> {
  const member = await memberRepository.findByEducatorId(educatorId);
  if (!member) return null;
  const clinic = await clinicRepository.findById(member.clinicId);
  return clinic ? { member, clinic } : null;
}

const byRoleThenName = (a: ClinicMemberEntry, b: ClinicMemberEntry) => {
  if (a.member.isAdmin !== b.member.isAdmin) return a.member.isAdmin ? -1 : 1;
  return a.educator.name.localeCompare(b.educator.name, "pt-BR", { sensitivity: "base" });
};

export async function loadClinicView(
  memberRepository: ClinicMemberRepository,
  educatorRepository: EducatorRepository,
  clinic: Clinic,
  myRole: TeamRole
): Promise<ClinicView> {
  const members = await memberRepository.listByClinicId(clinic.id);
  const educators = await educatorRepository.getByIds(members.map((member) => member.educatorId));
  const educatorById = new Map(educators.map((educator) => [educator.id.value, educator]));

  const entries: ClinicMemberEntry[] = [];
  for (const member of members) {
    const educator = educatorById.get(member.educatorId.value);
    if (educator) entries.push({ member, educator });
  }

  return { clinic, myRole, members: entries.sort(byRoleThenName) };
}
