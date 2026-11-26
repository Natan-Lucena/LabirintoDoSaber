import { describe, it, expect } from "vitest";
import { failure, Uuid } from "@wave-telecom/framework/core";
import { AssignEducatorUseCase } from "./assign-educator-use-case";
import { Educator } from "../../../../../domain/entities/educator";
import { Gender, Student } from "../../../../../domain/entities/student";
import { shareStudent } from "../../../../../domain/tests/fakes/student-share-fakes";
import { makeClinic } from "../../../clinic/use-cases/test-fixtures";
import { joinClinic, setupSharing } from "../test-fixtures";

const setup = () => {
  const ctx = setupSharing();
  const newEducator = Educator.create({
    name: "New Educator",
    email: "new@example.com",
    password: "password123",
  });
  ctx.educatorRepository.store.set(newEducator.id.value, newEducator);

  // Aluno com o dono na lista de educadores, como o cadastro grava.
  const student = Student.create({
    name: "Alice",
    age: 20,
    gender: Gender.Female,
    zipcode: "12345",
    road: "Main St",
    housenumber: "10A",
    phonenumber: "1234567890",
    learningTopics: ["Math"],
    educators: [ctx.owner],
    educatorId: ctx.owner.id,
  });
  ctx.studentRepository.store.set(student.id.value, student);

  const useCase = new AssignEducatorUseCase(
    ctx.studentAccess,
    ctx.studentRepository,
    ctx.educatorRepository,
    ctx.memberRepository,
    ctx.shareRepository
  );
  return { ...ctx, student, newEducator, useCase };
};

describe("AssignEducatorUseCase", () => {
  it("should fail if student does not exist", async () => {
    const { owner, useCase } = setup();

    const result = await useCase.execute({
      educatorId: owner.id,
      studentId: Uuid.random(),
      newEducatorEmail: "new@example.com",
    });

    expect(result).toEqual(failure("STUDENT_NOT_FOUND"));
  });

  it("should fail if the current educator is not the owner", async () => {
    const { outsider, student, useCase } = setup();

    const result = await useCase.execute({
      educatorId: outsider.id,
      studentId: student.id,
      newEducatorEmail: "new@example.com",
    });

    expect(result).toEqual(failure("STUDENT_NOT_ASSIGNED_TO_CURRENT_EDUCATOR"));
  });

  it("o compartilhado não transfere (EQ-11)", async () => {
    const { colleague, student, shareRepository, studentRepository, useCase } = setup();
    shareRepository.store.push(shareStudent(student, colleague.id));

    const result = await useCase.execute({
      educatorId: colleague.id,
      studentId: student.id,
      newEducatorEmail: "carla@mail.com",
    });

    expect(result).toEqual(failure("STUDENT_NOT_ASSIGNED_TO_CURRENT_EDUCATOR"));
    expect(studentRepository.save).not.toHaveBeenCalled();
  });

  it("should fail if new educator does not exist", async () => {
    const { owner, student, useCase } = setup();

    const result = await useCase.execute({
      educatorId: owner.id,
      studentId: student.id,
      newEducatorEmail: "nonexistent@example.com",
    });

    expect(result).toEqual(failure("NEW_EDUCATOR_NOT_FOUND"));
  });

  it("dono numa clínica: o novo educador precisa ser da mesma clínica (EQ-15)", async () => {
    const { owner, student, studentRepository, useCase } = setup();

    const result = await useCase.execute({
      educatorId: owner.id,
      studentId: student.id,
      newEducatorEmail: "new@example.com",
    });

    expect(result).toEqual(failure("NOT_IN_SAME_CLINIC"));
    expect(studentRepository.save).not.toHaveBeenCalled();
  });

  it("dono numa clínica: membro de outra clínica também é recusado (EQ-15)", async () => {
    const { owner, student, newEducator, memberRepository, useCase } = setup();
    joinClinic(memberRepository, makeClinic("Outra").id, newEducator);

    const result = await useCase.execute({
      educatorId: owner.id,
      studentId: student.id,
      newEducatorEmail: "new@example.com",
    });

    expect(result).toEqual(failure("NOT_IN_SAME_CLINIC"));
  });

  it("transfere: o colega vira dono, o antigo dono perde o acesso e os compartilhamentos somem", async () => {
    const { owner, colleague, admin, student, studentRepository, shareRepository, studentAccess, useCase } =
      setup();
    shareRepository.store.push(shareStudent(student, colleague.id), shareStudent(student, admin.id));

    const result = await useCase.execute({
      educatorId: owner.id,
      studentId: student.id,
      newEducatorEmail: colleague.email,
    });

    expect(result.ok).toBe(true);
    expect((result as any).value.educatorId).toBe(colleague.id.value);
    const saved = await studentRepository.getById(student.id);
    expect(saved?.educatorId.value).toBe(colleague.id.value);
    expect(shareRepository.store).toEqual([]);
    expect(await studentAccess.assertStudentAccess(student.id, owner.id)).toEqual({
      ok: false,
      error: "UNAUTHORIZED",
    });
    expect(await studentAccess.assertStudentAccess(student.id, admin.id)).toEqual({
      ok: false,
      error: "UNAUTHORIZED",
    });
    expect((await studentAccess.assertStudentAccess(student.id, colleague.id)).ok).toBe(true);

    // O novo dono transfere; o antigo não transfere mais.
    const byOldOwner = await useCase.execute({
      educatorId: owner.id,
      studentId: student.id,
      newEducatorEmail: admin.email,
    });
    expect(byOldOwner).toEqual(failure("STUDENT_NOT_ASSIGNED_TO_CURRENT_EDUCATOR"));
  });

  it("dono numa clínica: colega da mesma clínica é aceito", async () => {
    const { owner, colleague, student, useCase } = setup();

    const result = await useCase.execute({
      educatorId: owner.id,
      studentId: student.id,
      newEducatorEmail: colleague.email,
    });

    expect(result.ok).toBe(true);
    const updated = (result as any).value as { educators: { id: string }[] };
    expect(updated.educators.map((e) => e.id)).toContain(colleague.id.value);
  });

  it("should assign new educator successfully when the owner has no clinic", async () => {
    const { owner, student, newEducator, memberRepository, studentRepository, useCase } = setup();
    memberRepository.store.delete(owner.id.value);

    const result = await useCase.execute({
      educatorId: owner.id,
      studentId: student.id,
      newEducatorEmail: "new@example.com",
    });

    expect(result.ok).toBe(true);
    // A resposta expõe só { id, name, profession } dos educadores.
    const updatedStudent = (result as any).value as {
      educators: { id: string; name: string }[];
    };
    expect(updatedStudent.educators.map((e) => e.id)).toContain(owner.id.value);
    expect(updatedStudent.educators.map((e) => e.id)).toContain(newEducator.id.value);
    expect((result as any).value.educatorId).toBe(newEducator.id.value);

    const savedStudent = await studentRepository.getById(student.id);
    expect(savedStudent?.educators.map((e) => e.email)).toContain(newEducator.email);
  });
});
