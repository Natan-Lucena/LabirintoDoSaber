import { describe, it, expect } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { updateStudentSchema } from "./update-student-schema";

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
});
