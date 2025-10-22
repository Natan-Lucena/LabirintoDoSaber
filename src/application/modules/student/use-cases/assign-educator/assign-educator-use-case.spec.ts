import { describe, it, expect, beforeEach } from "vitest";
import {
  AssignEducatorUseCase,
  AssignEducatorUseCaseRequest,
} from "./assign-educator-use-case";
import { Educator } from "../../../../../domain/entities/educator";
import { Gender, Student } from "../../../../../domain/entities/student";
import { success, failure, Uuid } from "@wave-telecom/framework/core";
import { MockStudentRepository } from "../../../../../infraestructure/repositories/mock/student-repository-impl";
import { MockEducatorRepository } from "../../../../../infraestructure/repositories/mock/educator-repository-impl";

describe("AssignEducatorUseCase", () => {
  let studentRepository: MockStudentRepository;
  let educatorRepository: MockEducatorRepository;
  let useCase: AssignEducatorUseCase;

  let currentEducator: Educator;
  let newEducator: Educator;
  let student: Student;

  beforeEach(() => {
    studentRepository = new MockStudentRepository();
    educatorRepository = new MockEducatorRepository();
    useCase = new AssignEducatorUseCase(studentRepository, educatorRepository);

    currentEducator = Educator.create({
      name: "Current Educator",
      email: "current@example.com",
      password: "password123",
    });
    newEducator = Educator.create({
      name: "New Educator",
      email: "new@example.com",
      password: "password123",
    });

    // Salvando educadores no repositório
    educatorRepository.save(currentEducator);
    educatorRepository.save(newEducator);

    // Criando um estudante atribuído ao currentEducator
    student = Student.create({
      name: "Alice",
      age: 20,
      gender: Gender.Female,
      learningTopics: ["Math"],
      educators: [currentEducator],
    });

    studentRepository.save(student);
  });

  it("should fail if student does not exist", async () => {
    const result = await useCase.execute({
      studentId: Uuid.random(),
      currentEducatorEmail: "current@example.com",
      newEducatorEmail: "new@example.com",
    });

    expect(result).toEqual(failure("STUDENT_NOT_FOUND"));
  });

  it("should fail if student is not assigned to current educator", async () => {
    const anotherEducator = Educator.create({
      name: "Another",
      email: "another@example.com",
      password: "password123",
    });
    educatorRepository.save(anotherEducator);

    const result = await useCase.execute({
      studentId: student.id,
      currentEducatorEmail: "another@example.com",
      newEducatorEmail: "new@example.com",
    });

    expect(result).toEqual(failure("STUDENT_NOT_ASSIGNED_TO_CURRENT_EDUCATOR"));
  });

  it("should fail if new educator does not exist", async () => {
    const result = await useCase.execute({
      studentId: student.id,
      currentEducatorEmail: "current@example.com",
      newEducatorEmail: "nonexistent@example.com",
    });

    expect(result).toEqual(failure("NEW_EDUCATOR_NOT_FOUND"));
  });

  it("should assign new educator successfully", async () => {
    const result = await useCase.execute({
      studentId: student.id,
      currentEducatorEmail: "current@example.com",
      newEducatorEmail: "new@example.com",
    });

    expect(result.ok).toBe(true);
    const updatedStudent = (result as any).value as Student;
    expect(updatedStudent.educators.map((e) => e.email)).toContain(
      currentEducator.email
    );
    expect(updatedStudent.educators.map((e) => e.email)).toContain(
      newEducator.email
    );

    // Garantir que o repositório foi atualizado
    const savedStudent = await studentRepository.getById(student.id);
    expect(savedStudent?.educators.map((e) => e.email)).toContain(
      newEducator.email
    );
  });
});
