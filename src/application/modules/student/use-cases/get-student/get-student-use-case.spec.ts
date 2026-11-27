import { describe, expect, it } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { shareStudent } from "../../../../../domain/tests/fakes/student-share-fakes";
import { setupSharing } from "../test-fixtures";
import { GetStudentUseCase } from "./get-student-use-case";

const setup = () => {
  const ctx = setupSharing();
  const useCase = new GetStudentUseCase(ctx.studentAccess, ctx.educatorRepository);
  return { ...ctx, useCase };
};

describe("GetStudentUseCase (PP-09)", () => {
  it("dono: o aluno no formato da lista, com access OWNER e sem ownerName", async () => {
    const { owner, student, useCase } = setup();

    const result = await useCase.execute({ educatorId: owner.id, studentId: student.id.value });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      id: student.id.value,
      name: "Ana",
      educatorId: owner.id.value,
      status: "ACTIVE",
      access: "OWNER",
    });
    expect(result.value).not.toHaveProperty("ownerName");
    expect(result.value).not.toHaveProperty("archivedAt");
  });

  it("compartilhado: access SHARED e o nome do dono", async () => {
    const { colleague, student, shareRepository, useCase } = setup();
    shareRepository.store.push(shareStudent(student, colleague.id));

    const result = await useCase.execute({ educatorId: colleague.id, studentId: student.id.value });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({ access: "SHARED", ownerName: "Paula" });
  });

  it("arquivado continua legível (PA-03)", async () => {
    const { owner, student, useCase } = setup();
    const archivedAt = new Date("2026-11-01T10:00:00.000Z");
    student.archive(archivedAt);

    const result = await useCase.execute({ educatorId: owner.id, studentId: student.id.value });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({ status: "ARCHIVED", archivedAt });
  });

  it("sem acesso: UNAUTHORIZED", async () => {
    const { outsider, student, useCase } = setup();

    expect(await useCase.execute({ educatorId: outsider.id, studentId: student.id.value })).toEqual({
      ok: false,
      error: "UNAUTHORIZED",
    });
  });

  it("inexistente ou id inválido: STUDENT_NOT_FOUND", async () => {
    const { owner, useCase } = setup();

    expect(await useCase.execute({ educatorId: owner.id, studentId: Uuid.random().value })).toEqual({
      ok: false,
      error: "STUDENT_NOT_FOUND",
    });
    expect(await useCase.execute({ educatorId: owner.id, studentId: "123" })).toEqual({
      ok: false,
      error: "STUDENT_NOT_FOUND",
    });
  });
});
