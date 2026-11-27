import { describe, it, expect } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { Educator } from "../../entities/educator";
import { Gender, Student } from "../../entities/student";

const makeStudent = () => {
  const educator = Educator.create({
    name: "Educadora",
    email: "educadora@example.com",
    password: "hash",
  });
  return Student.create({
    name: "Aluno",
    age: 8,
    gender: Gender.Male,
    zipcode: "01001000",
    road: "Rua A",
    housenumber: "10",
    phonenumber: "11988887777",
    learningTopics: ["leitura", "escrita"],
    educators: [educator],
    educatorId: educator.id,
  });
};

describe("Student.update", () => {
  it("substitui learningTopics quando a lista vem, sem mesclar", () => {
    const student = makeStudent();

    student.update({ learningTopics: ["matemática"] });

    expect(student.learningTopics).toEqual(["matemática"]);
  });

  it("mantém learningTopics quando a lista não vem", () => {
    const student = makeStudent();

    student.update({ name: "Outro Nome" });

    expect(student.name).toBe("Outro Nome");
    expect(student.learningTopics).toEqual(["leitura", "escrita"]);
  });
});

describe("Student.transferTo", () => {
  it("troca o dono do paciente", () => {
    const student = makeStudent();
    const newOwner = Uuid.random();

    student.transferTo(newOwner);

    expect(student.educatorId.value).toBe(newOwner.value);
  });
});

describe("Student.update com null (PP-05)", () => {
  it("null apaga os campos do responsável", () => {
    const student = makeStudent();
    student.update({ guardianName: "Maria", guardianPhone: "11999990000", guardianRelationship: "Mãe" });

    student.update({ guardianName: null, guardianPhone: null, guardianRelationship: null });

    expect(student.guardianName).toBeUndefined();
    expect(student.guardianPhone).toBeUndefined();
    expect(student.guardianRelationship).toBeUndefined();
  });

  it("ausente mantém os campos do responsável", () => {
    const student = makeStudent();
    student.update({ guardianName: "Maria", guardianPhone: "11999990000", guardianRelationship: "Mãe" });

    student.update({ name: "Outro" });

    expect(student.guardianName).toBe("Maria");
    expect(student.guardianPhone).toBe("11999990000");
    expect(student.guardianRelationship).toBe("Mãe");
  });
});

describe("Student status (PA-01, PA-05)", () => {
  it("sem status gravado é ACTIVE", () => {
    const student = makeStudent();

    expect(student.status).toBe("ACTIVE");
    expect(student.isArchived).toBe(false);
    expect(student.archivedAt).toBeUndefined();
  });

  it("arquivar grava ARCHIVED e a data", () => {
    const student = makeStudent();
    const now = new Date("2026-11-26T12:00:00.000Z");

    student.archive(now);

    expect(student.status).toBe("ARCHIVED");
    expect(student.isArchived).toBe(true);
    expect(student.archivedAt).toEqual(now);
  });

  it("arquivar de novo mantém a data original", () => {
    const student = makeStudent();
    const first = new Date("2026-11-26T12:00:00.000Z");
    student.archive(first);

    student.archive(new Date("2026-11-27T12:00:00.000Z"));

    expect(student.archivedAt).toEqual(first);
  });

  it("reativar volta a ACTIVE e limpa archivedAt", () => {
    const student = makeStudent();
    student.archive(new Date());

    student.reactivate();

    expect(student.status).toBe("ACTIVE");
    expect(student.archivedAt).toBeUndefined();
  });
});
