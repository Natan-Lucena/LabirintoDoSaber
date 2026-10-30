import { describe, it, expect } from "vitest";
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
