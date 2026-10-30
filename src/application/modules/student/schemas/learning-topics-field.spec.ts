import { describe, it, expect } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { updateStudentSchema } from "./update-student-schema";
import { createStudentSchema } from "./create-student-schema";

const validStudent = {
  name: "Aluno",
  age: 8,
  gender: "male",
  zipcode: "01001000",
  road: "Rua A",
  housenumber: "10",
  phonenumber: "11988887777",
};

const schemas = [
  {
    label: "update",
    parse: (learningTopics: unknown) =>
      updateStudentSchema.safeParse({ id: Uuid.random().value, learningTopics }),
  },
  {
    label: "create",
    parse: (learningTopics: unknown) =>
      createStudentSchema.safeParse({ ...validStudent, learningTopics }),
  },
];

describe.each(schemas)("learningTopics no $label do aluno", ({ parse }) => {
  it.each([
    ["array JSON em texto (multipart)", '["leitura","escrita"]', ["leitura", "escrita"]],
    ["texto separado por vírgula", "leitura,escrita", ["leitura", "escrita"]],
    ["texto separado por vírgula com espaços", "leitura, escrita", ["leitura", "escrita"]],
    ["array já estruturado (JSON)", ["leitura"], ["leitura"]],
  ])("aceita %s", (_label, value, expected) => {
    const result = parse(value);

    expect(result.success).toBe(true);
    expect(result.data?.learningTopics).toEqual(expected);
  });

  it.each([
    ["lista vazia", []],
    ["lista vazia em texto", "[]"],
    ["item não-string", "[1,2]"],
    ["JSON que não é lista", '{"a":1}'],
    ["número em texto", "42"],
    ["item vazio", "leitura,,escrita"],
    ["item só com espaços", "leitura,  ,escrita"],
  ])("rejeita %s", (_label, value) => {
    expect(parse(value).success).toBe(false);
  });
});

describe("learningTopics no update do aluno", () => {
  it("é opcional", () => {
    const id = Uuid.random().value;
    const result = updateStudentSchema.safeParse({ id });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id });
  });
});

describe("learningTopics no create do aluno", () => {
  it("é obrigatório", () => {
    expect(createStudentSchema.safeParse(validStudent).success).toBe(false);
  });
});
