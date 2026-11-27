import { describe, expect, it } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { Clinic } from "../../entities/clinic";
import { ClinicMember, isLastAdmin } from "../../entities/clinic-member";

describe("Clinic", () => {
  it("cria com o nome sem espaços nas pontas", () => {
    const result = Clinic.create({ name: "  Clínica Aprender  " });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.name).toBe("Clínica Aprender");
  });

  it("recusa nome com menos de 2 ou mais de 80 caracteres", () => {
    expect(Clinic.create({ name: " A " })).toEqual({ ok: false, error: "INVALID_CLINIC_NAME" });
    expect(Clinic.create({ name: "x".repeat(81) })).toEqual({
      ok: false,
      error: "INVALID_CLINIC_NAME",
    });
    expect(Clinic.create({ name: "x".repeat(80) }).ok).toBe(true);
  });

  it("renomear devolve uma instância nova", () => {
    const created = Clinic.create({ name: "Antiga" });
    if (!created.ok) throw new Error("setup");
    const renamed = created.value.rename("Nova");
    expect(renamed.ok).toBe(true);
    if (!renamed.ok) return;
    expect(renamed.value.name).toBe("Nova");
    expect(renamed.value.id.value).toBe(created.value.id.value);
    expect(created.value.name).toBe("Antiga");
    expect(created.value.rename("x")).toEqual({ ok: false, error: "INVALID_CLINIC_NAME" });
  });
});

describe("ClinicMember", () => {
  const clinicId = Uuid.random();

  it("mudar o papel devolve uma instância nova", () => {
    const member = ClinicMember.create({ clinicId, educatorId: Uuid.random(), role: "ADMIN" });
    const changed = member.changeRole("PROFESSIONAL");
    expect(changed.role).toBe("PROFESSIONAL");
    expect(member.role).toBe("ADMIN");
  });

  it("isLastAdmin só é verdade para o único ADMIN (EQ-08)", () => {
    const admin = ClinicMember.create({ clinicId, educatorId: Uuid.random(), role: "ADMIN" });
    const pro = ClinicMember.create({ clinicId, educatorId: Uuid.random(), role: "PROFESSIONAL" });
    const otherAdmin = ClinicMember.create({ clinicId, educatorId: Uuid.random(), role: "ADMIN" });

    expect(isLastAdmin(admin, [admin, pro])).toBe(true);
    expect(isLastAdmin(pro, [admin, pro])).toBe(false);
    expect(isLastAdmin(admin, [admin, pro, otherAdmin])).toBe(false);
  });
});
