import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CreateStudentUseCase,
  CreateStudentUseCaseRequest,
} from "./create-student-use-case";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { Educator } from "../../../../../domain/entities/educator";
import { Gender } from "../../../../../domain/entities/student";
import { success, failure } from "@wave-telecom/framework/core";

// Mock dos repositórios
const mockStudentRepository = (): StudentRepository =>
  ({
    save: vi.fn(),
  } as unknown as StudentRepository);

const mockEducatorRepository = (): EducatorRepository =>
  ({
    getByEmail: vi.fn(),
  } as unknown as EducatorRepository);

describe("CreateStudentUseCase", () => {
  let studentRepository: StudentRepository;
  let educatorRepository: EducatorRepository;
  let useCase: CreateStudentUseCase;

  beforeEach(() => {
    studentRepository = mockStudentRepository();
    educatorRepository = mockEducatorRepository();
    useCase = new CreateStudentUseCase(studentRepository, educatorRepository);
  });

  it("should fail if educator does not exist", async () => {
    (educatorRepository.getByEmail as any).mockResolvedValue(null);

    const request: CreateStudentUseCaseRequest = {
      name: "Alice",
      age: 20,
      gender: Gender.Female,
      learningTopics: ["Math", "Science"],
      educatorEmail: "nonexistent@example.com",
    };

    const result = await useCase.execute(request);

    expect(result).toEqual(failure("EDUCATOR_NOT_FOUND"));
    expect(studentRepository.save).not.toHaveBeenCalled();
  });

  it("should create student if educator exists", async () => {
    const educator = Educator.create({
      name: "John Doe",
      email: "john@example.com",
      password: "password123",
    });
    (educatorRepository.getByEmail as any).mockResolvedValue(educator);

    const request: CreateStudentUseCaseRequest = {
      name: "Bob",
      age: 22,
      gender: Gender.Male,
      learningTopics: ["History", "Geography"],
      educatorEmail: "john@example.com",
    };

    const result = await useCase.execute(request);

    expect(result.ok).toBe(true);
    expect(studentRepository.save).toHaveBeenCalled();

    const savedStudent = (studentRepository.save as any).mock.calls[0][0];
    expect(savedStudent.name).toBe("Bob");
    expect(savedStudent.age).toBe(22);
    expect(savedStudent.gender).toBe(Gender.Male);
    expect(savedStudent.learningTopics).toEqual(["History", "Geography"]);
    expect(savedStudent.educators).toContain(educator);
  });
});
