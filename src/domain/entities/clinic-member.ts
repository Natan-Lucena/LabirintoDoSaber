import { Uuid } from "@wave-telecom/framework/core";
import { TeamRole } from "./clinic";

export interface ClinicMemberProps {
  id: Uuid;
  clinicId: Uuid;
  educatorId: Uuid;
  role: TeamRole;
  joinedAt: Date;
}

// Vínculo do educador com a clínica. Um educador está em no máximo uma
// clínica (EQ-01): educatorId é único na coleção.
export class ClinicMember {
  private constructor(private readonly props: ClinicMemberProps) {}

  static create(props: { clinicId: Uuid; educatorId: Uuid; role: TeamRole; now?: Date }) {
    return new ClinicMember({
      id: Uuid.random(),
      clinicId: props.clinicId,
      educatorId: props.educatorId,
      role: props.role,
      joinedAt: props.now ?? new Date(),
    });
  }

  static fromPersistence(props: ClinicMemberProps): ClinicMember {
    return new ClinicMember(props);
  }

  changeRole(role: TeamRole): ClinicMember {
    return new ClinicMember({ ...this.props, role });
  }

  get id(): Uuid {
    return this.props.id;
  }

  get clinicId(): Uuid {
    return this.props.clinicId;
  }

  get educatorId(): Uuid {
    return this.props.educatorId;
  }

  get role(): TeamRole {
    return this.props.role;
  }

  get joinedAt(): Date {
    return this.props.joinedAt;
  }

  get isAdmin(): boolean {
    return this.props.role === "ADMIN";
  }
}

// EQ-08: o membro é o único ADMIN da clínica? Sair, ser removido ou virar
// PROFESSIONAL deixaria a clínica sem ADMIN.
export function isLastAdmin(member: ClinicMember, members: ClinicMember[]): boolean {
  if (!member.isAdmin) return false;
  const admins = members.filter((other) => other.isAdmin);
  return admins.length === 1 && admins[0].educatorId.value === member.educatorId.value;
}
