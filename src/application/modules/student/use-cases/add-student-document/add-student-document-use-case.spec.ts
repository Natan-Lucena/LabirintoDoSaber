import { describe, it, expect, vi, beforeEach } from "vitest";
import { AddStudentDocumentUseCase } from "./add-student-document-use-case";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { Educator } from "../../../../../domain/entities/educator";
import { Gender, Student } from "../../../../../domain/entities/student";
import { failure, Uuid } from "@wave-telecom/framework/core";
import { FileStorage } from "../../../../services/file-storage";

const mockStudentRepository = (): StudentRepository =>
  ({
    getById: vi.fn(),
    save: vi.fn((student) => Promise.resolve(student)),
  } as unknown as StudentRepository);

const mockEducatorRepository = (): EducatorRepository =>
  ({
    getByEmail: vi.fn(),
  } as unknown as EducatorRepository);

const mockFileStorage = () =>
  ({
    saveFile: vi
      .fn()
      .mockResolvedValue({ url: "http://mockurl.com/doc.pdf" }),
  } as unknown as FileStorage);

const buildStudent = (educator: Educator) =>
  Student.create({
    name: "Alice",
    age: 10,
    gender: Gender.Female,
    zipcode: "12345",
    road: "Main St",
    housenumber: "10A",
    phonenumber: "1234567890",
    learningTopics: ["Math"],
    educators: [educator],
    educatorId: educator.id,
  });

const fakeFile = {
  originalname: "laudo.pdf",
  buffer: Buffer.from("x"),
  mimetype: "application/pdf",
} as unknown as Express.Multer.File;

describe("AddStudentDocumentUseCase", () => {
  let studentRepository: StudentRepository;
  let educatorRepository: EducatorRepository;
  let fileStorage: FileStorage;
  let useCase: AddStudentDocumentUseCase;
  let educator: Educator;

  beforeEach(() => {
    studentRepository = mockStudentRepository();
    educatorRepository = mockEducatorRepository();
    fileStorage = mockFileStorage();
    useCase = new AddStudentDocumentUseCase(
      studentRepository,
      educatorRepository,
      fileStorage
    );
    educator = Educator.create({
      name: "John",
      email: "john@example.com",
      password: "password123",
    });
  });

  it("should fail if student does not exist", async () => {
    (studentRepository.getById as any).mockResolvedValue(null);

    const result = await useCase.execute({
      studentId: Uuid.random().value,
      educatorEmail: educator.email,
      file: fakeFile,
    });

    expect(result).toEqual(failure("STUDENT_NOT_FOUND"));
    expect(fileStorage.saveFile).not.toHaveBeenCalled();
    expect(studentRepository.save).not.toHaveBeenCalled();
  });

  it("should fail if educator does not exist", async () => {
    (studentRepository.getById as any).mockResolvedValue(buildStudent(educator));
    (educatorRepository.getByEmail as any).mockResolvedValue(null);

    const result = await useCase.execute({
      studentId: Uuid.random().value,
      educatorEmail: "ghost@example.com",
      file: fakeFile,
    });

    expect(result).toEqual(failure("EDUCATOR_NOT_FOUND"));
    expect(fileStorage.saveFile).not.toHaveBeenCalled();
  });

  it("should fail if student belongs to another educator", async () => {
    const otherEducator = Educator.create({
      name: "Jane",
      email: "jane@example.com",
      password: "password123",
    });
    (studentRepository.getById as any).mockResolvedValue(
      buildStudent(otherEducator)
    );
    (educatorRepository.getByEmail as any).mockResolvedValue(educator);

    const result = await useCase.execute({
      studentId: Uuid.random().value,
      educatorEmail: educator.email,
      file: fakeFile,
    });

    expect(result).toEqual(
      failure("STUDENT_NOT_ASSIGNED_TO_CURRENT_EDUCATOR")
    );
    expect(fileStorage.saveFile).not.toHaveBeenCalled();
  });

  it("should upload the file and append the document to the student", async () => {
    const student = buildStudent(educator);
    (studentRepository.getById as any).mockResolvedValue(student);
    (educatorRepository.getByEmail as any).mockResolvedValue(educator);

    const result = await useCase.execute({
      studentId: student.id.value,
      educatorEmail: educator.email,
      file: fakeFile,
    });

    expect(result.ok).toBe(true);
    expect(fileStorage.saveFile).toHaveBeenCalledWith({
      taskId: student.id.value,
      file: fakeFile,
    });
    expect(studentRepository.save).toHaveBeenCalled();

    expect(student.documents).toHaveLength(1);
    expect(student.documents[0]).toMatchObject({
      name: "laudo.pdf",
      url: "http://mockurl.com/doc.pdf",
    });

    if (result.ok) {
      expect(result.value.documents).toHaveLength(1);
    }
  });

  it("should keep previously attached documents (N documents)", async () => {
    const student = buildStudent(educator);
    student.addDocument({
      id: "existing-doc",
      name: "antigo.pdf",
      url: "http://mockurl.com/antigo.pdf",
      uploadedAt: new Date(),
    });
    (studentRepository.getById as any).mockResolvedValue(student);
    (educatorRepository.getByEmail as any).mockResolvedValue(educator);

    await useCase.execute({
      studentId: student.id.value,
      educatorEmail: educator.email,
      file: fakeFile,
    });

    expect(student.documents).toHaveLength(2);
  });
});
