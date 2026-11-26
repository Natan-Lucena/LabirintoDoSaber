import { describe, it, expect, vi, beforeEach } from "vitest";
import { RegisterEducatorUseCase } from "./register-educator-use-case";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { failure } from "@wave-telecom/framework/core";
import {
  makeClinicInviteRepository,
  makeClinicMemberRepository,
  makeEducator,
  makeEducatorRepository,
  makeInvite,
  setupClinic,
  usedInvite,
} from "../../../clinic/use-cases/test-fixtures";

const DAY_MS = 24 * 60 * 60 * 1000;

// Mock do repositório
const mockEducatorRepository = (): EducatorRepository =>
  ({
    getByEmail: vi.fn(),
    save: vi.fn(),
  } as unknown as EducatorRepository);

describe("RegisterEducatorUseCase", () => {
  let educatorRepository: EducatorRepository;
  let useCase: RegisterEducatorUseCase;

  beforeEach(() => {
    educatorRepository = mockEducatorRepository();
    useCase = new RegisterEducatorUseCase(
      educatorRepository,
      makeClinicInviteRepository(),
      makeClinicMemberRepository()
    );
  });

  it("should fail if educator already exists", async () => {
    (educatorRepository.getByEmail as any).mockResolvedValue({
      id: "123",
      name: "Jane Doe",
      email: "jane@example.com",
    });

    const result = await useCase.execute({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "password123",
    });

    expect(result).toEqual(failure("EDUCATOR_ALREADY_EXISTS"));
    expect(educatorRepository.save).not.toHaveBeenCalled();
  });

  it("should register educator successfully", async () => {
    (educatorRepository.getByEmail as any).mockResolvedValue(null);

    const result = await useCase.execute({
      name: "John Doe",
      email: "john@example.com",
      password: "mypassword",
    });

    expect(result.ok).toBe(true);

    // captura o Educator real salvo
    const savedEducator = (educatorRepository.save as any).mock.calls[0][0];

    if (result.ok) {
      expect(result.value).toEqual({
        id: savedEducator.id, // agora verifica o ID exato
        name: "John Doe",
      });
    }

    expect(educatorRepository.save).toHaveBeenCalledTimes(1);

    expect(savedEducator.name).toBe("John Doe");
    expect(savedEducator.email).toBe("john@example.com");
    expect(savedEducator.password).not.toBe("mypassword");
  });
});

describe("RegisterEducatorUseCase com inviteCode (EQ-06)", () => {
  const setup = () => {
    const { admin, clinic, memberRepository } = setupClinic();
    const educatorRepository = makeEducatorRepository([admin]);
    const invite = makeInvite(clinic, admin.id, { role: "PROFESSIONAL" });
    const inviteRepository = makeClinicInviteRepository([invite]);
    const useCase = new RegisterEducatorUseCase(
      educatorRepository,
      inviteRepository,
      memberRepository
    );
    return { admin, clinic, invite, educatorRepository, inviteRepository, memberRepository, useCase };
  };

  const body = { name: "Nina Souza", email: "nina@mail.com", password: "segredo123" };

  it("BE-EQ-03: código válido cria a conta e o membro com o papel do convite", async () => {
    const { clinic, invite, educatorRepository, inviteRepository, memberRepository, useCase } = setup();

    const result = await useCase.execute({ ...body, inviteCode: invite.code.toLowerCase() });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const created = await educatorRepository.getByEmail("nina@mail.com");
    expect(created).not.toBeNull();
    expect(result.value).toEqual({ id: created!.id, name: "Nina Souza" });
    const member = memberRepository.store.get(created!.id.value);
    expect(member?.clinicId.value).toBe(clinic.id.value);
    expect(member?.role).toBe("PROFESSIONAL");
    expect(inviteRepository.store.get(invite.id.value)!.usedBy?.value).toBe(created!.id.value);
  });

  it("BE-EQ-03: código inválido devolve INVITE_INVALID e não cria a conta", async () => {
    const { admin, clinic, educatorRepository, inviteRepository, memberRepository, useCase } = setup();
    const expired = makeInvite(clinic, admin.id, { now: new Date(Date.now() - 8 * DAY_MS) });
    const used = usedInvite(makeInvite(clinic, admin.id), makeEducator("Lia").id, new Date());
    const revoked = makeInvite(clinic, admin.id).revoke(new Date());
    for (const invite of [expired, used, revoked]) inviteRepository.store.set(invite.id.value, invite);

    for (const inviteCode of [expired.code, used.code, revoked.code, "ZZZZ9999", "x"]) {
      const result = await useCase.execute({ ...body, inviteCode });
      expect(result).toEqual({ ok: false, error: "INVITE_INVALID" });
    }
    expect(educatorRepository.save).not.toHaveBeenCalled();
    expect(memberRepository.create).not.toHaveBeenCalled();
  });

  it("desfaz a conta se o convite foi consumido por outro entre a validação e o consumo", async () => {
    const { invite, educatorRepository, inviteRepository, memberRepository, useCase } = setup();
    inviteRepository.consume.mockResolvedValueOnce(false);

    const result = await useCase.execute({ ...body, inviteCode: invite.code });

    expect(result).toEqual({ ok: false, error: "INVITE_INVALID" });
    expect(educatorRepository.save).toHaveBeenCalledTimes(1);
    const savedId = educatorRepository.save.mock.calls[0][0].id;
    expect(educatorRepository.delete).toHaveBeenCalledWith(savedId);
    expect(await educatorRepository.getByEmail("nina@mail.com")).toBeNull();
    expect(memberRepository.create).not.toHaveBeenCalled();
  });

  it("e-mail já usado continua EDUCATOR_ALREADY_EXISTS, sem consumir o convite", async () => {
    const { admin, invite, inviteRepository, useCase } = setup();

    const result = await useCase.execute({ ...body, email: admin.email, inviteCode: invite.code });

    expect(result).toEqual({ ok: false, error: "EDUCATOR_ALREADY_EXISTS" });
    expect(inviteRepository.consume).not.toHaveBeenCalled();
  });
});
