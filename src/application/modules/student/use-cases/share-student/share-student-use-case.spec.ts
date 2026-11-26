import { describe, expect, it } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { makeClinic, makeEducator } from "../../../clinic/use-cases/test-fixtures";
import { joinClinic, setupSharing } from "../test-fixtures";
import { ShareStudentUseCase } from "./share-student-use-case";

const setup = () => {
  const ctx = setupSharing();
  const useCase = new ShareStudentUseCase(
    ctx.studentAccess,
    ctx.shareRepository,
    ctx.memberRepository,
    ctx.educatorRepository
  );
  return { ...ctx, useCase };
};

describe("ShareStudentUseCase", () => {
  it("o dono compartilha com um colega da clínica e recebe a lista com nome e papel", async () => {
    const { owner, colleague, student, shareRepository, useCase } = setup();

    const result = await useCase.execute({
      educatorId: owner.id,
      studentId: student.id.value,
      targetEducatorId: colleague.id.value,
    });

    expect(result).toEqual({
      ok: true,
      value: [
        {
          educatorId: colleague.id.value,
          name: "Carla",
          role: "PROFESSIONAL",
          sharedAt: expect.any(Date),
        },
      ],
    });
    expect(shareRepository.store).toHaveLength(1);
    expect(shareRepository.store[0].sharedBy.value).toBe(owner.id.value);
  });

  it("repetir é idempotente (EQ-10)", async () => {
    const { owner, colleague, student, shareRepository, useCase } = setup();
    const request = {
      educatorId: owner.id,
      studentId: student.id.value,
      targetEducatorId: colleague.id.value,
    };

    await useCase.execute(request);
    const second = await useCase.execute(request);

    expect(second.ok).toBe(true);
    expect((second as any).value).toHaveLength(1);
    expect(shareRepository.store).toHaveLength(1);
  });

  it("compartilha com o ADMIN e traz o papel dele", async () => {
    const { owner, admin, student, useCase } = setup();

    const result = await useCase.execute({
      educatorId: owner.id,
      studentId: student.id.value,
      targetEducatorId: admin.id.value,
    });

    expect((result as any).value).toEqual([
      expect.objectContaining({ educatorId: admin.id.value, name: "Beatriz", role: "ADMIN" }),
    ]);
  });

  it("educador fora da clínica: 400 NOT_IN_SAME_CLINIC", async () => {
    const { owner, outsider, student, shareRepository, useCase } = setup();

    const result = await useCase.execute({
      educatorId: owner.id,
      studentId: student.id.value,
      targetEducatorId: outsider.id.value,
    });

    expect(result).toEqual({ ok: false, error: "NOT_IN_SAME_CLINIC" });
    expect(shareRepository.create).not.toHaveBeenCalled();
  });

  it("membro de outra clínica: 400 NOT_IN_SAME_CLINIC", async () => {
    const { owner, student, memberRepository, educatorRepository, useCase } = setup();
    const other = makeEducator("Outra");
    educatorRepository.store.set(other.id.value, other);
    joinClinic(memberRepository, makeClinic("Outra clínica").id, other);

    const result = await useCase.execute({
      educatorId: owner.id,
      studentId: student.id.value,
      targetEducatorId: other.id.value,
    });

    expect(result).toEqual({ ok: false, error: "NOT_IN_SAME_CLINIC" });
  });

  it("dono sem clínica: 400 NOT_IN_SAME_CLINIC", async () => {
    const { owner, colleague, student, memberRepository, useCase } = setup();
    memberRepository.store.delete(owner.id.value);

    const result = await useCase.execute({
      educatorId: owner.id,
      studentId: student.id.value,
      targetEducatorId: colleague.id.value,
    });

    expect(result).toEqual({ ok: false, error: "NOT_IN_SAME_CLINIC" });
  });

  it("educador inexistente ou id inválido: 400 NOT_IN_SAME_CLINIC", async () => {
    const { owner, student, useCase } = setup();

    for (const targetEducatorId of [Uuid.random().value, "nao-e-uuid"]) {
      const result = await useCase.execute({
        educatorId: owner.id,
        studentId: student.id.value,
        targetEducatorId,
      });
      expect(result).toEqual({ ok: false, error: "NOT_IN_SAME_CLINIC" });
    }
  });

  it("só o dono compartilha: o compartilhado e o ADMIN recebem 403 (EQ-10, EQ-11)", async () => {
    const { owner, colleague, admin, student, useCase } = setup();
    await useCase.execute({
      educatorId: owner.id,
      studentId: student.id.value,
      targetEducatorId: colleague.id.value,
    });

    const byShared = await useCase.execute({
      educatorId: colleague.id,
      studentId: student.id.value,
      targetEducatorId: admin.id.value,
    });
    const byAdmin = await useCase.execute({
      educatorId: admin.id,
      studentId: student.id.value,
      targetEducatorId: colleague.id.value,
    });

    expect(byShared).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(byAdmin).toEqual({ ok: false, error: "UNAUTHORIZED" });
  });

  it("aluno inexistente ou id não-UUID: 404 STUDENT_NOT_FOUND", async () => {
    const { owner, colleague, useCase } = setup();

    for (const studentId of [Uuid.random().value, "nao-e-uuid"]) {
      const result = await useCase.execute({
        educatorId: owner.id,
        studentId,
        targetEducatorId: colleague.id.value,
      });
      expect(result).toEqual({ ok: false, error: "STUDENT_NOT_FOUND" });
    }
  });

  it("compartilhar com o próprio dono não cria nada", async () => {
    const { owner, student, shareRepository, useCase } = setup();

    const result = await useCase.execute({
      educatorId: owner.id,
      studentId: student.id.value,
      targetEducatorId: owner.id.value,
    });

    expect(result).toEqual({ ok: true, value: [] });
    expect(shareRepository.store).toHaveLength(0);
  });
});
