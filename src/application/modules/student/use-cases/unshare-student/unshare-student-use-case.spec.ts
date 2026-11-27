import { describe, expect, it } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { shareStudent } from "../../../../../domain/tests/fakes/student-share-fakes";
import { setupSharing } from "../test-fixtures";
import { UnshareStudentUseCase } from "./unshare-student-use-case";

const setup = () => {
  const ctx = setupSharing();
  ctx.shareRepository.store.push(
    shareStudent(ctx.student, ctx.colleague.id),
    shareStudent(ctx.student, ctx.admin.id)
  );
  const useCase = new UnshareStudentUseCase(
    ctx.studentAccess,
    ctx.shareRepository,
    ctx.memberRepository,
    ctx.educatorRepository
  );
  return { ...ctx, useCase };
};

describe("UnshareStudentUseCase", () => {
  it("o dono desfaz e recebe a lista restante", async () => {
    const { owner, colleague, admin, student, shareRepository, useCase } = setup();

    const result = await useCase.execute({
      educatorId: owner.id,
      studentId: student.id.value,
      targetEducatorId: colleague.id.value,
    });

    expect(result).toEqual({
      ok: true,
      value: [expect.objectContaining({ educatorId: admin.id.value, name: "Beatriz", role: "ADMIN" })],
    });
    expect(shareRepository.store.map((share) => share.educatorId.value)).toEqual([
      admin.id.value,
    ]);
  });

  it("compartilhamento inexistente: 404 SHARE_NOT_FOUND", async () => {
    const { owner, outsider, student, useCase } = setup();

    for (const targetEducatorId of [outsider.id.value, "nao-e-uuid"]) {
      const result = await useCase.execute({
        educatorId: owner.id,
        studentId: student.id.value,
        targetEducatorId,
      });
      expect(result).toEqual({ ok: false, error: "SHARE_NOT_FOUND" });
    }
  });

  it("só o dono desfaz: o compartilhado recebe 403", async () => {
    const { colleague, admin, student, shareRepository, useCase } = setup();

    const result = await useCase.execute({
      educatorId: colleague.id,
      studentId: student.id.value,
      targetEducatorId: admin.id.value,
    });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(shareRepository.store).toHaveLength(2);
  });

  it("aluno inexistente: 404 STUDENT_NOT_FOUND", async () => {
    const { owner, colleague, useCase } = setup();

    const result = await useCase.execute({
      educatorId: owner.id,
      studentId: Uuid.random().value,
      targetEducatorId: colleague.id.value,
    });

    expect(result).toEqual({ ok: false, error: "STUDENT_NOT_FOUND" });
  });
});
