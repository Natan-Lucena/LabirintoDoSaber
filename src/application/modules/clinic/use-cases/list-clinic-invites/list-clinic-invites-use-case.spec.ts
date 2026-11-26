import { describe, expect, it } from "vitest";
import {
  makeClinic,
  makeClinicInviteRepository,
  makeEducator,
  makeInvite,
  setupClinic,
  usedInvite,
} from "../test-fixtures";
import { ListClinicInvitesUseCase } from "./list-clinic-invites-use-case";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("ListClinicInvitesUseCase", () => {
  it("ADMIN vê só os convites ativos da própria clínica", async () => {
    const { admin, clinic, clinicRepository, memberRepository } = setupClinic();
    const active = makeInvite(clinic, admin.id);
    const expired = makeInvite(clinic, admin.id, { now: new Date(Date.now() - 8 * DAY_MS) });
    const revoked = makeInvite(clinic, admin.id).revoke(new Date());
    const used = usedInvite(makeInvite(clinic, admin.id), makeEducator("Xavier").id, new Date());
    const otherClinic = makeInvite(makeClinic("Outra"), admin.id);
    const inviteRepository = makeClinicInviteRepository([active, expired, revoked, used, otherClinic]);
    const useCase = new ListClinicInvitesUseCase(clinicRepository, memberRepository, inviteRepository);

    const result = await useCase.execute({ educatorId: admin.id });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.invites.map((invite) => invite.id.value)).toEqual([active.id.value]);
    expect(result.value.clinic.id.value).toBe(clinic.id.value);
  });

  it("PROFESSIONAL recebe FORBIDDEN_ROLE (EQ-03)", async () => {
    const pro = makeEducator("Paula");
    const { clinicRepository, memberRepository } = setupClinic([
      { educator: pro, role: "PROFESSIONAL" },
    ]);
    const useCase = new ListClinicInvitesUseCase(
      clinicRepository,
      memberRepository,
      makeClinicInviteRepository()
    );

    const result = await useCase.execute({ educatorId: pro.id });

    expect(result).toEqual({ ok: false, error: "FORBIDDEN_ROLE" });
  });

  it("NOT_IN_CLINIC para quem não tem clínica", async () => {
    const { clinicRepository, memberRepository } = setupClinic();
    const useCase = new ListClinicInvitesUseCase(
      clinicRepository,
      memberRepository,
      makeClinicInviteRepository()
    );

    const result = await useCase.execute({ educatorId: makeEducator("Sem").id });

    expect(result).toEqual({ ok: false, error: "NOT_IN_CLINIC" });
  });
});
