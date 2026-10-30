import { describe, it, expect } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { Educator } from "../../domain/entities/educator";
import { Gender, Student } from "../../domain/entities/student";
import {
  TaskNotebook,
  TaskNotebookCategory,
} from "../../domain/entities/task-notebook";
import { mapEducatorToResponse } from "./map-educator";
import { mapStudentToResponse } from "./map-student";
import { mapTaskNotebookToResponse } from "./map-task-notebook";

const makeEducator = () =>
  Educator.create({
    name: "Educadora",
    email: "educadora@example.com",
    password: "$2b$10$hash-secreto",
    photoUrl: "https://cdn.example.com/foto.png",
    contact: "11999999999",
    profession: "Psicopedagoga",
  });

const hasKeyDeep = (value: unknown, keys: string[]): boolean => {
  if (Array.isArray(value)) return value.some((item) => hasKeyDeep(item, keys));
  if (value && typeof value === "object") {
    return Object.entries(value).some(
      ([key, nested]) => keys.includes(key) || hasKeyDeep(nested, keys)
    );
  }
  return false;
};

const serialize = (value: unknown) => JSON.parse(JSON.stringify(value));

describe("mapEducatorToResponse", () => {
  it("devolve o mesmo formato do perfil do educador", () => {
    const educator = makeEducator();

    expect(mapEducatorToResponse(educator)).toEqual({
      id: educator.id.value,
      name: "Educadora",
      email: "educadora@example.com",
      photoUrl: "https://cdn.example.com/foto.png",
      contact: "11999999999",
      profession: "Psicopedagoga",
    });
  });

  it("não expõe senha nem hash ao serializar", () => {
    const json = JSON.stringify(mapEducatorToResponse(makeEducator()));

    expect(json).not.toContain("hash-secreto");
    expect(hasKeyDeep(JSON.parse(json), ["password", "_password"])).toBe(false);
  });
});

describe("serialização das respostas sem dados sensíveis do educador", () => {
  it("o caderno embute o educador mapeado, sem senha", () => {
    const educator = makeEducator();
    const created = TaskNotebook.create({
      educator,
      category: TaskNotebookCategory.Reading,
      description: "Caderno",
    });
    if (!created.ok) throw new Error("fixture inválida");

    const body = serialize(mapTaskNotebookToResponse(created.value));

    expect(hasKeyDeep(body, ["password", "_password"])).toBe(false);
    expect(body.educator).toEqual(serialize(mapEducatorToResponse(educator)));
    expect(body.id).toBe(created.value.id.value);
  });

  it("o aluno expõe educators só com id, nome e profissão", () => {
    const educator = makeEducator();
    const student = Student.create({
      name: "Aluno",
      age: 8,
      gender: Gender.Male,
      zipcode: "01001000",
      road: "Rua A",
      housenumber: "10",
      phonenumber: "11988887777",
      learningTopics: ["leitura"],
      educators: [educator],
      educatorId: educator.id,
    });

    const body = serialize(mapStudentToResponse(student));

    expect(body.educators).toEqual([
      { id: educator.id.value, name: "Educadora", profession: "Psicopedagoga" },
    ]);
    expect(hasKeyDeep(body, ["password", "_password"])).toBe(false);
    expect(hasKeyDeep(body.educators, ["email", "_email"])).toBe(false);
    expect(JSON.stringify(body)).not.toContain("hash-secreto");
  });

  it("profissão ausente vira null em educators", () => {
    const educator = Educator.create({
      id: Uuid.random(),
      name: "Sem Profissão",
      email: "sp@example.com",
      password: "hash",
    });
    const student = Student.create({
      name: "Aluno",
      age: 8,
      gender: Gender.Female,
      zipcode: "01001000",
      road: "Rua A",
      housenumber: "10",
      phonenumber: "11988887777",
      learningTopics: ["leitura"],
      educators: [educator],
      educatorId: educator.id,
    });

    expect(mapStudentToResponse(student).educators).toEqual([
      { id: educator.id.value, name: "Sem Profissão", profession: null },
    ]);
  });
});
