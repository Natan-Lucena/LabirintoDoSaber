import { describe, expect, it } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { Gender, Student } from "../../entities/student";
import { StudentAccessService } from "../../services/student-access-service";
import {
  makeShareRepository,
  makeStudentRepositoryFake,
  shareStudent,
} from "../fakes/student-share-fakes";

const makeStudent = (educatorId: Uuid, name = "Ana") =>
  Student.create({
    name,
    age: 8,
    gender: Gender.Female,
    zipcode: "00000000",
    road: "Rua",
    housenumber: "1",
    phonenumber: "11999999999",
    learningTopics: [],
    educators: [],
    educatorId,
  });

const setup = () => {
  const owner = Uuid.random();
  const colleague = Uuid.random();
  const outsider = Uuid.random();
  const student = makeStudent(owner);
  const studentRepository = makeStudentRepositoryFake([student]);
  const shareRepository = makeShareRepository();
  const service = new StudentAccessService(studentRepository, shareRepository);
  return { owner, colleague, outsider, student, studentRepository, shareRepository, service };
};

describe("StudentAccessService", () => {
  describe("assertStudentAccess", () => {
    it("o dono acessa nos dois modos", async () => {
      const { owner, student, service } = setup();

      for (const mode of ["clinical", "owner"] as const) {
        const result = await service.assertStudentAccess(student.id, owner, { mode });
        expect(result).toEqual({ ok: true, value: student });
      }
    });

    it("o compartilhado acessa no modo clínico (padrão), não no de dono", async () => {
      const { colleague, student, shareRepository, service } = setup();
      shareRepository.store.push(shareStudent(student, colleague));

      expect(await service.assertStudentAccess(student.id, colleague)).toEqual({
        ok: true,
        value: student,
      });
      expect(
        await service.assertStudentAccess(student.id, colleague, { mode: "owner" })
      ).toEqual({ ok: false, error: "UNAUTHORIZED" });
    });

    it("sem compartilhamento: UNAUTHORIZED", async () => {
      const { outsider, student, service } = setup();

      expect(await service.assertStudentAccess(student.id, outsider)).toEqual({
        ok: false,
        error: "UNAUTHORIZED",
      });
    });

    it("depois de desfeito o compartilhamento, UNAUTHORIZED", async () => {
      const { colleague, student, shareRepository, service } = setup();
      shareRepository.store.push(shareStudent(student, colleague));
      await shareRepository.delete(student.id, colleague);

      expect(await service.assertStudentAccess(student.id, colleague)).toEqual({
        ok: false,
        error: "UNAUTHORIZED",
      });
    });

    it("aluno inexistente: STUDENT_NOT_FOUND", async () => {
      const { owner, service } = setup();

      expect(await service.assertStudentAccess(Uuid.random(), owner)).toEqual({
        ok: false,
        error: "STUDENT_NOT_FOUND",
      });
    });

    it("o dono não consulta compartilhamentos", async () => {
      const { owner, student, shareRepository, service } = setup();

      await service.assertStudentAccess(student.id, owner);

      expect(shareRepository.find).not.toHaveBeenCalled();
    });
  });

  describe("filterAccessible e accessibleIdsAmong", () => {
    it("mantém os do educador e os compartilhados com ele, numa consulta só", async () => {
      const { owner, colleague, student, studentRepository, shareRepository, service } = setup();
      const own = makeStudent(colleague, "Bia");
      const other = makeStudent(owner, "Caio");
      studentRepository.store.set(own.id.value, own);
      studentRepository.store.set(other.id.value, other);
      shareRepository.store.push(shareStudent(student, colleague));

      const accessible = await service.filterAccessible([student, own, other], colleague);
      const ids = await service.accessibleIdsAmong([student.id, own.id, other.id], colleague);

      expect(accessible.map((s) => s.name)).toEqual(["Ana", "Bia"]);
      expect([...ids].sort()).toEqual([student.id.value, own.id.value].sort());
      expect(shareRepository.listByStudentIdsAndEducator).toHaveBeenCalledTimes(2);
    });

    it("lista vazia não consulta nada", async () => {
      const { owner, studentRepository, service } = setup();

      expect(await service.accessibleIdsAmong([], owner)).toEqual(new Set());
      expect(studentRepository.getByIds).not.toHaveBeenCalled();
    });
  });

  describe("listAccessibleStudents", () => {
    it("traz os do educador (OWNER) e os compartilhados (SHARED)", async () => {
      const { owner, colleague, student, studentRepository, shareRepository, service } = setup();
      const own = makeStudent(colleague, "Bia");
      studentRepository.store.set(own.id.value, own);
      shareRepository.store.push(shareStudent(student, colleague));

      const result = await service.listAccessibleStudents(colleague);

      expect(result.map(({ student: s, access }) => [s.name, access])).toEqual([
        ["Bia", "OWNER"],
        ["Ana", "SHARED"],
      ]);
      expect(await service.listAccessibleStudents(owner)).toEqual([
        { student, access: "OWNER" },
      ]);
    });
  });
});
