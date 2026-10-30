import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { UpdateStudentUseCase } from "./update-student-use-case";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { Educator } from "../../../../../domain/entities/educator";
import { Gender, Student } from "../../../../../domain/entities/student";
import { FileStorage } from "../../../../services/file-storage";

const owner = Educator.create({
  name: "Educadora",
  email: "educadora@example.com",
  password: "hash",
});

const makeStudent = () =>
  Student.create({
    name: "Aluno",
    age: 8,
    gender: Gender.Male,
    zipcode: "01001000",
    road: "Rua A",
    housenumber: "10",
    phonenumber: "11988887777",
    learningTopics: ["leitura", "escrita"],
    educators: [owner],
    educatorId: owner.id,
  });

describe("UpdateStudentUseCase", () => {
  let studentRepository: StudentRepository;
  let educatorRepository: EducatorRepository;
  let useCase: UpdateStudentUseCase;

  beforeEach(() => {
    studentRepository = {
      getById: vi.fn(),
      save: vi.fn().mockImplementation(async (student: Student) => student),
    } as unknown as StudentRepository;
    educatorRepository = {
      getByEmail: vi.fn().mockResolvedValue(owner),
    } as unknown as EducatorRepository;
    useCase = new UpdateStudentUseCase(
      studentRepository,
      { saveFile: vi.fn() } as unknown as FileStorage,
      educatorRepository
    );
  });

  it("substitui learningTopics quando a lista é enviada", async () => {
    const student = makeStudent();
    (studentRepository.getById as any).mockResolvedValue(student);

    const result = await useCase.execute({
      id: student.id.value,
      educatorEmail: owner.email,
      learningTopics: ["matemática"],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("esperava sucesso");
    expect(result.value.learningTopics).toEqual(["matemática"]);
    const saved = (studentRepository.save as any).mock.calls[0][0] as Student;
    expect(saved.learningTopics).toEqual(["matemática"]);
  });

  it("mantém learningTopics quando a lista não é enviada", async () => {
    const student = makeStudent();
    (studentRepository.getById as any).mockResolvedValue(student);

    const result = await useCase.execute({
      id: student.id.value,
      educatorEmail: owner.email,
      name: "Novo Nome",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("esperava sucesso");
    expect(result.value.name).toBe("Novo Nome");
    expect(result.value.learningTopics).toEqual(["leitura", "escrita"]);
  });

  it("devolve STUDENT_NOT_FOUND quando o aluno não existe", async () => {
    (studentRepository.getById as any).mockResolvedValue(null);

    const result = await useCase.execute({
      id: Uuid.random().value,
      educatorEmail: owner.email,
      learningTopics: ["matemática"],
    });

    expect(result).toEqual({ ok: false, error: "STUDENT_NOT_FOUND" });
    expect(studentRepository.save).not.toHaveBeenCalled();
  });
});
