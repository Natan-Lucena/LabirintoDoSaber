// Repositórios em memória para os specs do módulo de clínica. Respeitam os
// índices únicos (educatorId do membro, code do convite) e o consumo
// condicional do convite, como os repositórios Prisma.
import { vi } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { Clinic, TeamRole } from "../../../../domain/entities/clinic";
import { ClinicMember } from "../../../../domain/entities/clinic-member";
import { ClinicInvite } from "../../../../domain/entities/clinic-invite";
import { Educator } from "../../../../domain/entities/educator";
import { ClinicRepository } from "../../../../domain/repositories/clinic-repository";
import {
  ClinicMemberAlreadyExistsError,
  ClinicMemberRepository,
} from "../../../../domain/repositories/clinic-member-repository";
import {
  ClinicInviteRepository,
  InviteCodeTakenError,
} from "../../../../domain/repositories/clinic-invite-repository";
import { EducatorRepository } from "../../../../domain/repositories/educator-repository";
import { RateLimitRepository } from "../../../../domain/repositories/rate-limit-repository";
import { ClinicDepartureService } from "../../../../domain/services/clinic-departure-service";

export const makeEducator = (name: string, email = `${name.toLowerCase()}@mail.com`) =>
  Educator.create({ name, email, password: "hash-secreto", profession: "Psicopedagoga" });

export const makeClinic = (name = "Clínica Aprender") => {
  const result = Clinic.create({ name });
  if (!result.ok) throw new Error("setup");
  return result.value;
};

export const makeInvite = (
  clinic: Clinic,
  createdBy: Uuid,
  props: { role?: TeamRole; now?: Date; code?: string } = {}
) =>
  ClinicInvite.create({
    clinicId: clinic.id,
    role: props.role ?? "PROFESSIONAL",
    createdBy,
    now: props.now,
    code: props.code,
  });

export const usedInvite = (invite: ClinicInvite, usedBy: Uuid, usedAt: Date) =>
  ClinicInvite.fromPersistence({
    id: invite.id,
    clinicId: invite.clinicId,
    code: invite.code,
    role: invite.role,
    createdBy: invite.createdBy,
    createdAt: invite.createdAt,
    expiresAt: invite.expiresAt,
    usedAt,
    usedBy,
  });

export const makeClinicRepository = (initial: Clinic[] = []) => {
  const store = new Map(initial.map((clinic) => [clinic.id.value, clinic]));
  return {
    store,
    save: vi.fn(async (clinic: Clinic) => {
      store.set(clinic.id.value, clinic);
    }),
    findById: vi.fn(async (id: Uuid) => store.get(id.value) ?? null),
    delete: vi.fn(async (id: Uuid) => {
      store.delete(id.value);
    }),
  } satisfies ClinicRepository & { store: Map<string, Clinic> };
};

export const makeClinicMemberRepository = (initial: ClinicMember[] = []) => {
  const store = new Map(initial.map((member) => [member.educatorId.value, member]));
  return {
    store,
    create: vi.fn(async (member: ClinicMember) => {
      if (store.has(member.educatorId.value)) throw new ClinicMemberAlreadyExistsError();
      store.set(member.educatorId.value, member);
    }),
    save: vi.fn(async (member: ClinicMember) => {
      store.set(member.educatorId.value, member);
    }),
    findByEducatorId: vi.fn(async (educatorId: Uuid) => store.get(educatorId.value) ?? null),
    listByClinicId: vi.fn(async (clinicId: Uuid) =>
      [...store.values()].filter((member) => member.clinicId.value === clinicId.value)
    ),
    deleteByEducatorId: vi.fn(async (educatorId: Uuid) => {
      store.delete(educatorId.value);
    }),
  } satisfies ClinicMemberRepository & { store: Map<string, ClinicMember> };
};

export const makeClinicInviteRepository = (initial: ClinicInvite[] = []) => {
  const store = new Map(initial.map((invite) => [invite.id.value, invite]));
  const active = (clinicId: Uuid, now: Date) =>
    [...store.values()]
      .filter((invite) => invite.clinicId.value === clinicId.value && invite.isActive(now))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return {
    store,
    create: vi.fn(async (invite: ClinicInvite) => {
      if ([...store.values()].some((other) => other.code === invite.code)) {
        throw new InviteCodeTakenError();
      }
      store.set(invite.id.value, invite);
    }),
    findById: vi.fn(async (id: Uuid) => store.get(id.value) ?? null),
    findByCode: vi.fn(
      async (code: string) => [...store.values()].find((invite) => invite.code === code) ?? null
    ),
    listActiveByClinicId: vi.fn(async (clinicId: Uuid, now: Date) => active(clinicId, now)),
    countActiveByClinicId: vi.fn(async (clinicId: Uuid, now: Date) => active(clinicId, now).length),
    consume: vi.fn(async (inviteId: Uuid, usedBy: Uuid, now: Date) => {
      const invite = store.get(inviteId.value);
      if (!invite || !invite.isActive(now)) return false;
      store.set(inviteId.value, usedInvite(invite, usedBy, now));
      return true;
    }),
    release: vi.fn(async (inviteId: Uuid, usedBy: Uuid) => {
      const invite = store.get(inviteId.value);
      if (!invite || invite.usedBy?.value !== usedBy.value) return;
      store.set(
        inviteId.value,
        ClinicInvite.fromPersistence({
          id: invite.id,
          clinicId: invite.clinicId,
          code: invite.code,
          role: invite.role,
          createdBy: invite.createdBy,
          createdAt: invite.createdAt,
          expiresAt: invite.expiresAt,
        })
      );
    }),
    revoke: vi.fn(async (inviteId: Uuid, revokedAt: Date) => {
      const invite = store.get(inviteId.value);
      if (invite) store.set(inviteId.value, invite.revoke(revokedAt));
    }),
    revokeActive: vi.fn(async (filter: { clinicId: Uuid; createdBy?: Uuid }, now: Date) => {
      for (const invite of active(filter.clinicId, now)) {
        if (filter.createdBy && invite.createdBy.value !== filter.createdBy.value) continue;
        store.set(invite.id.value, invite.revoke(now));
      }
    }),
  } satisfies ClinicInviteRepository & { store: Map<string, ClinicInvite> };
};

export const makeEducatorRepository = (initial: Educator[] = []) => {
  const store = new Map(initial.map((educator) => [educator.id.value, educator]));
  return {
    store,
    save: vi.fn(async (educator: Educator) => {
      store.set(educator.id.value, educator);
      return educator;
    }),
    search: vi.fn(async () => null),
    getByEmail: vi.fn(
      async (email: string) =>
        [...store.values()].find((educator) => educator.email === email) ?? null
    ),
    getByIds: vi.fn(async (ids: Uuid[]) => {
      const wanted = new Set(ids.map((id) => id.value));
      return [...store.values()].filter((educator) => wanted.has(educator.id.value));
    }),
    delete: vi.fn(async (id: Uuid) => {
      store.delete(id.value);
    }),
  } satisfies EducatorRepository & { store: Map<string, Educator> };
};

// Contador por chave com limite, como o repositório Prisma.
export const makeRateLimitRepository = () => {
  const counts = new Map<string, number>();
  return {
    counts,
    tryConsume: vi.fn(async (key: string, limit: number, _expiresAt: Date) => {
      const count = counts.get(key) ?? 0;
      if (count >= limit) return false;
      counts.set(key, count + 1);
      return true;
    }),
  } satisfies RateLimitRepository & { counts: Map<string, number> };
};

export const makeDepartureService = () =>
  ({
    undoSharesOf: vi.fn(async () => undefined),
  }) satisfies ClinicDepartureService;

// Clínica com um ADMIN e, opcionalmente, outros membros já gravados.
export const setupClinic = (
  extra: { educator: Educator; role: TeamRole }[] = [],
  adminName = "Beatriz"
) => {
  const admin = makeEducator(adminName);
  const clinic = makeClinic();
  const members = [
    ClinicMember.create({ clinicId: clinic.id, educatorId: admin.id, role: "ADMIN" }),
    ...extra.map(({ educator, role }) =>
      ClinicMember.create({ clinicId: clinic.id, educatorId: educator.id, role })
    ),
  ];
  return {
    admin,
    clinic,
    clinicRepository: makeClinicRepository([clinic]),
    memberRepository: makeClinicMemberRepository(members),
    educatorRepository: makeEducatorRepository([admin, ...extra.map(({ educator }) => educator)]),
  };
};
