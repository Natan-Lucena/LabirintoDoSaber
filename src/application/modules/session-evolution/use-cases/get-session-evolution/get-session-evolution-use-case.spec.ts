import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { GetSessionEvolutionUseCase } from "./get-session-evolution-use-case";
import { SessionEvolution } from "../../../../../domain/entities/session-evolution";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { makeSession, makeStudent } from "../test-fixtures";

describe("GetSessionEvolutionUseCase", () => {
  const educatorId = Uuid.random();
  const student = makeStudent(educatorId);

  let evolution: SessionEvolution;
  let evolutionRepository: SessionEvolutionRepository;
  let studentRepository: StudentRepository;
  let useCase: GetSessionEvolutionUseCase;

  beforeEach(() => {
    const created = SessionEvolution.create({
      session: makeSession({ studentId: student.id, educatorId }),
      educatorId,
      criteria: [],
      descriptiveRecord: "Registro",
    });
    if (!created.ok) throw new Error(created.error);
    evolution = created.value;

    evolutionRepository = {
      findById: vi.fn().mockResolvedValue(evolution),
    } as unknown as SessionEvolutionRepository;
    studentRepository = {
      getById: vi.fn().mockResolvedValue(student),
    } as unknown as StudentRepository;
    useCase = new GetSessionEvolutionUseCase(evolutionRepository, studentRepository);
  });

  it("should return the evolution of the student owner", async () => {
    const result = await useCase.execute({ educatorId, evolutionId: evolution.id.value });

    expect(result).toEqual({ ok: true, value: evolution });
  });

  it("should return UNAUTHORIZED for another educator", async () => {
    const result = await useCase.execute({
      educatorId: Uuid.random(),
      evolutionId: evolution.id.value,
    });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
  });

  it("should return UNAUTHORIZED when the student changed owner", async () => {
    (studentRepository.getById as any).mockResolvedValue(makeStudent(Uuid.random()));

    const result = await useCase.execute({ educatorId, evolutionId: evolution.id.value });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
  });

  it("should return EVOLUTION_NOT_FOUND for a missing evolution or an invalid id", async () => {
    expect(await useCase.execute({ educatorId, evolutionId: "123" })).toEqual({
      ok: false,
      error: "EVOLUTION_NOT_FOUND",
    });

    (evolutionRepository.findById as any).mockResolvedValue(null);
    expect(
      await useCase.execute({ educatorId, evolutionId: Uuid.random().value })
    ).toEqual({ ok: false, error: "EVOLUTION_NOT_FOUND" });
  });
});
