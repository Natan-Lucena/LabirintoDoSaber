import { ClinicInvite } from "../../domain/entities/clinic-invite";
import { ClinicView } from "../../application/modules/clinic/use-cases/clinic-view";

// Só campos públicos do educador: nada de senha ou hash.
export const mapClinicViewToResponse = (view: ClinicView) => ({
  clinic: {
    id: view.clinic.id.value,
    name: view.clinic.name,
    createdAt: view.clinic.createdAt.toISOString(),
  },
  myRole: view.myRole,
  members: view.members.map(({ member, educator }) => ({
    educatorId: educator.id.value,
    name: educator.name,
    email: educator.email,
    photoUrl: educator.photoUrl,
    profession: educator.profession,
    role: member.role,
    joinedAt: member.joinedAt.toISOString(),
  })),
});

export const mapClinicInviteToResponse = (invite: ClinicInvite, clinicName: string) => ({
  id: invite.id.value,
  code: invite.code,
  role: invite.role,
  createdBy: invite.createdBy.value,
  expiresAt: invite.expiresAt.toISOString(),
  shareMessage: invite.shareMessage(clinicName),
  createdAt: invite.createdAt.toISOString(),
});
