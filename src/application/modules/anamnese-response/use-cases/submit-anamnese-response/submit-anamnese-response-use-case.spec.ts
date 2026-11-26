import { describe, it, expect, vi, beforeEach } from "vitest";
import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { SubmitAnamneseResponseUseCase } from "./submit-anamnese-response-use-case";
import { AnamneseTemplateRepository } from "../../../../../domain/repositories/anamnese-template-repository";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { AnamneseResponse } from "../../../../../domain/entities/anamnese-response";
import { AnamneseQuestionType } from "../../../../../domain/entities/anamnese-template";
import { makeStudentAccess, makeShareRepository } from "../../../../../domain/tests/fakes/student-share-fakes";
import { StudentShare } from "../../../../../domain/entities/student-share";

const mockTemplateRepository = (): AnamneseTemplateRepository =>
  ({ findById: vi.fn() } as unknown as AnamneseTemplateRepository);

const mockResponseRepository = (): AnamneseResponseRepository =>
  ({ save: vi.fn() } as unknown as AnamneseResponseRepository);

const mockStudentRepository = (): StudentRepository =>
  ({ getById: vi.fn() } as unknown as StudentRepository);

const optionId = Uuid.random().value;

const makeTemplate = () => ({
  id: Uuid.random(),
  educatorId: Uuid.random(),
  title: "Anamnese",
  questions: [
    {
      id: "q1",
      text: "Pergunta obrigatória",
      type: AnamneseQuestionType.MultipleChoice,
      required: true,
      order: 0,
      options: [{ id: optionId, text: "Sim" }],
    },
    {
      id: "q2",
      text: "Pergunta opcional",
      type: AnamneseQuestionType.Descriptive,
      required: false,
      order: 1,
      options: [],
    },
  ],
});

const makeStudent = (educatorId: Uuid) => ({ id: Uuid.random(), educatorId });

describe("SubmitAnamneseResponseUseCase", () => {
  let templateRepository: AnamneseTemplateRepository;
  let responseRepository: AnamneseResponseRepository;
  let studentRepository: StudentRepository;
  let shareRepository: ReturnType<typeof makeShareRepository>;
  let useCase: SubmitAnamneseResponseUseCase;
  const educatorId = Uuid.random();

  beforeEach(() => {
    vi.restoreAllMocks();
    templateRepository = mockTemplateRepository();
    responseRepository = mockResponseRepository();
    studentRepository = mockStudentRepository();
    shareRepository = makeShareRepository();
    useCase = new SubmitAnamneseResponseUseCase(
      templateRepository,
      responseRepository,
      makeStudentAccess(studentRepository, shareRepository)
    );
  });

  it("should submit response successfully", async () => {
    const template = makeTemplate();
    const student = makeStudent(educatorId);
    (templateRepository.findById as any).mockResolvedValue(template);
    (studentRepository.getById as any).mockResolvedValue(student);

    const result = await useCase.execute({
      templateId: Uuid.random().value,
      educatorId,
      studentId: Uuid.random().value,
      answers: [{ questionId: "q1", selectedOptionId: optionId }],
    });

    expect(result.ok).toBe(true);
    expect(responseRepository.save).toHaveBeenCalledOnce();
  });

  it("should return failure when template is not found", async () => {
    (templateRepository.findById as any).mockResolvedValue(null);
    (studentRepository.getById as any).mockResolvedValue(makeStudent(educatorId));

    const result = await useCase.execute({
      templateId: Uuid.random().value,
      educatorId,
      studentId: Uuid.random().value,
      answers: [],
    });

    expect(result).toEqual(failure("TEMPLATE_NOT_FOUND"));
    expect(responseRepository.save).not.toHaveBeenCalled();
  });

  it("should return failure when student is not found", async () => {
    (templateRepository.findById as any).mockResolvedValue(makeTemplate());
    (studentRepository.getById as any).mockResolvedValue(null);

    const result = await useCase.execute({
      templateId: Uuid.random().value,
      educatorId,
      studentId: Uuid.random().value,
      answers: [],
    });

    expect(result).toEqual(failure("STUDENT_NOT_FOUND"));
    expect(responseRepository.save).not.toHaveBeenCalled();
  });

  it("should return failure when a required question has no answer", async () => {
    (templateRepository.findById as any).mockResolvedValue(makeTemplate());
    (studentRepository.getById as any).mockResolvedValue(makeStudent(educatorId));

    const result = await useCase.execute({
      templateId: Uuid.random().value,
      educatorId,
      studentId: Uuid.random().value,
      answers: [],
    });

    expect(result).toEqual(failure("MISSING_REQUIRED_ANSWER"));
    expect(responseRepository.save).not.toHaveBeenCalled();
  });

  it("should return failure when response creation fails due to invalid option id", async () => {
    (templateRepository.findById as any).mockResolvedValue(makeTemplate());
    (studentRepository.getById as any).mockResolvedValue(makeStudent(educatorId));

    const result = await useCase.execute({
      templateId: Uuid.random().value,
      educatorId,
      studentId: Uuid.random().value,
      answers: [{ questionId: "q1", selectedOptionId: "invalid-option-id" }],
    });

    expect(result).toEqual(failure("INVALID_OPTION_ID"));
    expect(responseRepository.save).not.toHaveBeenCalled();
  });

  it("should return failure when AnamneseResponse.create fails", async () => {
    (templateRepository.findById as any).mockResolvedValue(makeTemplate());
    (studentRepository.getById as any).mockResolvedValue(makeStudent(educatorId));
    vi.spyOn(AnamneseResponse, "create").mockReturnValue(failure("MISSING_REQUIRED_ANSWER") as any);

    const result = await useCase.execute({
      templateId: Uuid.random().value,
      educatorId,
      studentId: Uuid.random().value,
      answers: [],
    });

    expect(result).toEqual(failure("MISSING_REQUIRED_ANSWER"));
    expect(responseRepository.save).not.toHaveBeenCalled();
  });

  it("returns UNAUTHORIZED for a student of another educator", async () => {
    (templateRepository.findById as any).mockResolvedValue(makeTemplate());
    (studentRepository.getById as any).mockResolvedValue(makeStudent(Uuid.random()));

    const result = await useCase.execute({
      templateId: Uuid.random().value,
      educatorId,
      studentId: Uuid.random().value,
      answers: [{ questionId: "q1", selectedOptionId: optionId }],
    });

    expect(result).toEqual(failure("UNAUTHORIZED"));
    expect(responseRepository.save).not.toHaveBeenCalled();
  });

  it("lets a colleague submit for a shared student, recorded with the colleague as author (EQ-11)", async () => {
    const student = makeStudent(Uuid.random());
    (templateRepository.findById as any).mockResolvedValue(makeTemplate());
    (studentRepository.getById as any).mockResolvedValue(student);
    await shareRepository.create(
      StudentShare.create({
        studentId: student.id,
        educatorId,
        sharedBy: student.educatorId,
      })
    );

    const result = await useCase.execute({
      templateId: Uuid.random().value,
      educatorId,
      studentId: student.id.value,
      answers: [{ questionId: "q1", selectedOptionId: optionId }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect((result.value as AnamneseResponse).educatorId.value).toBe(educatorId.value);
  });
});
