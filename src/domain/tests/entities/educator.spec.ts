import { describe, it, expect } from "vitest";
import { Educator } from "../../entities/educator";

describe("Educator Entity", () => {
  it("should update password when new password is different", () => {
    const educator = Educator.create({
      name: "John Doe",
      email: "john@example.com",
      password: "oldPassword",
    });

    educator.updatePassword("newPassword");

    expect(educator.password).toBe("newPassword");
  });

  it("should throw an error if new password is the same as current", () => {
    const educator = Educator.create({
      name: "Jane Doe",
      email: "jane@example.com",
      password: "samePassword",
    });

    expect(() => educator.updatePassword("samePassword")).toThrowError("PASSWORD_SAME_AS_OLD");

  });
});
