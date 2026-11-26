import { describe, expect, it } from "vitest";
import { shareStudent } from "../../../../../domain/tests/fakes/student-share-fakes";
import { makeStudent, setupSharing } from "../test-fixtures";
import { ListStudentsByEducatorUseCase } from "./list-students-by-educator-use-case";

const setup = () => {
  const ctx = setupSharing();
  const useCase = new ListStudentsByEducatorUseCase(ctx.studentAccess, ctx.educatorRepository);
  return { ...ctx, useCase };
};

describe("ListStudentsByEducatorUseCase", () => {
  it("traz os pacientes do educador com access OWNER e sem ownerName", async () => {
    const { owner, student, useCase } = setup();

    const result = await useCase.execute({ educatorId: owner.id });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: student.id.value, name: "Ana", access: "OWNER" });
    expect(result[0]).not.toHaveProperty("ownerName");
  });

  it("traz os compartilhados com access SHARED e o nome do dono (EQ-13)", async () => {
    const { owner, colleague, student, studentRepository, shareRepository, useCase } = setup();
    const own = makeStudent(colleague.id, "Bruno");
    studentRepository.store.set(own.id.value, own);
    shareRepository.store.push(shareStudent(student, colleague.id));

    const result = await useCase.execute({ educatorId: colleague.id });

    expect(result).toEqual([
      expect.objectContaining({ id: own.id.value, access: "OWNER" }),
      expect.objectContaining({
        id: student.id.value,
        access: "SHARED",
        ownerName: "Paula",
        educatorId: owner.id.value,
      }),
    ]);
    expect(result[0]).not.toHaveProperty("ownerName");
  });

  it("ADMIN não vê paciente não compartilhado com ele (BE-EQ-06)", async () => {
    const { admin, student, shareRepository, useCase } = setup();

    expect(await useCase.execute({ educatorId: admin.id })).toEqual([]);

    shareRepository.store.push(shareStudent(student, admin.id));
    const afterShare = await useCase.execute({ educatorId: admin.id });

    expect(afterShare.map((item) => item.id)).toEqual([student.id.value]);
    expect(afterShare[0].access).toBe("SHARED");
  });

  describe("status (PA-03)", () => {
    const withArchived = () => {
      const ctx = setup();
      const archived = makeStudent(ctx.owner.id, "Bruno");
      archived.archive(new Date("2026-11-01T10:00:00.000Z"));
      ctx.studentRepository.store.set(archived.id.value, archived);
      return { ...ctx, archived };
    };

    it("padrão ACTIVE: o arquivado sai da lista", async () => {
      const { owner, student, useCase } = withArchived();

      const result = await useCase.execute({ educatorId: owner.id });

      expect(result.map((item) => item.id)).toEqual([student.id.value]);
      expect(result[0].status).toBe("ACTIVE");
    });

    it("ARCHIVED: só os arquivados", async () => {
      const { owner, archived, useCase } = withArchived();

      const result = await useCase.execute({ educatorId: owner.id, status: "ARCHIVED" });

      expect(result.map((item) => item.id)).toEqual([archived.id.value]);
      expect(result[0]).toMatchObject({ status: "ARCHIVED", archivedAt: archived.archivedAt });
    });

    it("ALL: todos", async () => {
      const { owner, student, archived, useCase } = withArchived();

      const result = await useCase.execute({ educatorId: owner.id, status: "ALL" });

      expect(result.map((item) => item.id).sort()).toEqual(
        [student.id.value, archived.id.value].sort()
      );
    });

    it("compartilhado arquivado também sai do padrão", async () => {
      const { colleague, student, shareRepository, useCase } = setup();
      shareRepository.store.push(shareStudent(student, colleague.id));
      student.archive(new Date());

      expect(await useCase.execute({ educatorId: colleague.id })).toEqual([]);
      expect(
        (await useCase.execute({ educatorId: colleague.id, status: "ARCHIVED" })).map((i) => i.id)
      ).toEqual([student.id.value]);
    });
  });
});
