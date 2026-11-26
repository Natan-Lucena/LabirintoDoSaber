import { describe, expect, it } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { shareStudent } from "../../../../../domain/tests/fakes/student-share-fakes";
import { setupSharing } from "../test-fixtures";
import { ListStudentSharesUseCase } from "./list-student-shares-use-case";

const setup = () => {
  const ctx = setupSharing();
  ctx.shareRepository.store.push(
    shareStudent(ctx.student, ctx.colleague.id, new Date("2026-11-01T10:00:00Z")),
    shareStudent(ctx.student, ctx.admin.id, new Date("2026-11-02T10:00:00Z"))
  );
  const useCase = new ListStudentSharesUseCase(
    ctx.studentAccess,
    ctx.shareRepository,
    ctx.memberRepository,
    ctx.educatorRepository
  );
  return { ...ctx, useCase };
};

describe("ListStudentSharesUseCase", () => {
  it("o dono vê os compartilhamentos com nome, papel e data", async () => {
    const { owner, colleague, admin, student, useCase } = setup();

    const result = await useCase.execute({ educatorId: owner.id, studentId: student.id.value });

    expect(result).toEqual({
      ok: true,
      value: [
        {
          educatorId: colleague.id.value,
          name: "Carla",
          role: "PROFESSIONAL",
          sharedAt: new Date("2026-11-01T10:00:00Z"),
        },
        {
          educatorId: admin.id.value,
          name: "Beatriz",
          role: "ADMIN",
          sharedAt: new Date("2026-11-02T10:00:00Z"),
        },
      ],
    });
  });

  it("o compartilhado também lê a lista", async () => {
    const { colleague, student, useCase } = setup();

    const result = await useCase.execute({ educatorId: colleague.id, studentId: student.id.value });

    expect(result.ok).toBe(true);
    expect((result as any).value).toHaveLength(2);
  });

  it("quem não acessa o paciente recebe 403", async () => {
    const { outsider, student, useCase } = setup();

    const result = await useCase.execute({ educatorId: outsider.id, studentId: student.id.value });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
  });

  it("aluno inexistente ou id não-UUID: 404 STUDENT_NOT_FOUND", async () => {
    const { owner, useCase } = setup();

    for (const studentId of [Uuid.random().value, "x"]) {
      const result = await useCase.execute({ educatorId: owner.id, studentId });
      expect(result).toEqual({ ok: false, error: "STUDENT_NOT_FOUND" });
    }
  });
});
