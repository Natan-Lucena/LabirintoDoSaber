import { describe, it, expect, vi, beforeEach } from "vitest";
import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { SubmitAnamneseResponseUseCase } from "./submit-anamnese-response-use-case";
import { AnamneseTemplateRepository } from "../../../../../domain/repositories/anamnese-template-repository";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { AnamneseResponse } from "../../../../../domain/entities/anamnese-response";
import { AnamneseQuestionType } from "../../../../../domain/entities/anamnese-template";

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

const makeStudent = () => ({ id: Uuid.random() });

describe("SubmitAnamneseResponseUseCase", () => {
  let templateRepository: AnamneseTemplateRepository;
  let responseRepository: AnamneseResponseRepository;
  let studentRepository: StudentRepository;
  let useCase: SubmitAnamneseResponseUseCase;
  const educatorId = Uuid.random();

  beforeEach(() => {
    vi.restoreAllMocks();
    templateRepository = mockTemplateRepository();
    responseRepository = mockResponseRepository();
    studentRepository = mockStudentRepository();
    useCase = new SubmitAnamneseResponseUseCase(
      templateRepository,
      responseRepository,
      studentRepository
    );
  });

  it("should submit response successfully", async () => {
    const template = makeTemplate();
    const student = makeStudent();
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
    (studentRepository.getById as any).mockResolvedValue(makeStudent());

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
    (studentRepository.getById as any).mockResolvedValue(makeStudent());

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
    (studentRepository.getById as any).mockResolvedValue(makeStudent());

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
    (studentRepository.getById as any).mockResolvedValue(makeStudent());
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
});
