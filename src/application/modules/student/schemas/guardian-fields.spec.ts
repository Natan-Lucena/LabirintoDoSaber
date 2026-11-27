import { describe, it, expect } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { updateStudentSchema } from "./update-student-schema";
import { createStudentSchema } from "./create-student-schema";

const id = Uuid.random().value;

describe("guardian fields", () => {
  it("should treat empty multipart values as absent", () => {
    const result = updateStudentSchema.safeParse({
      id,
      guardianName: "",
      guardianPhone: "",
      guardianRelationship: "",
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ id });
  });

  it("should accept a digits-only phone and reject a masked one", () => {
    expect(
      updateStudentSchema.safeParse({ id, guardianPhone: "11987654321" }).success
    ).toBe(true);
    expect(
      updateStudentSchema.safeParse({ id, guardianPhone: "(11) 98765-4321" }).success
    ).toBe(false);
  });

  it("o texto \"null\" no multipart (ou null no JSON) vira null, que apaga (PP-05)", () => {
    expect(
      updateStudentSchema.safeParse({
        id,
        guardianName: "null",
        guardianPhone: "null",
        guardianRelationship: null,
      }).data
    ).toEqual({ id, guardianName: null, guardianPhone: null, guardianRelationship: null });
  });

  it("ausente continua ausente (mantém o valor)", () => {
    expect(updateStudentSchema.safeParse({ id, name: "Ana" }).data).toEqual({ id, name: "Ana" });
  });

  it("no cadastro, \"null\" não apaga nada: é tratado como ausente", () => {
    const result = createStudentSchema.safeParse({
      name: "Ana",
      age: 8,
      gender: "female",
      zipcode: "01001000",
      road: "Rua A",
      housenumber: "10",
      phonenumber: "11988887777",
      learningTopics: ["leitura"],
      guardianName: "null",
    });

    expect(result.success).toBe(true);
    expect(result.data?.guardianName).toBeUndefined();
  });
});
