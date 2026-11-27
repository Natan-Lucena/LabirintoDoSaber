import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { GetSessionEvolutionUseCase } from "./get-session-evolution-use-case";
import { Educator } from "../../../../../domain/entities/educator";
import { SessionEvolution } from "../../../../../domain/entities/session-evolution";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import {
  makeShareRepository,
  makeStudentAccess,
  shareStudent,
} from "../../../../../domain/tests/fakes/student-share-fakes";
import { makeSession, makeStudent } from "../test-fixtures";

describe("GetSessionEvolutionUseCase", () => {
  const owner = Educator.create({
    name: "Dona Marta",
    email: "marta@mail.com",
    password: "hash",
  });
  const educatorId = owner.id;
  const student = makeStudent(educatorId);

  let evolution: SessionEvolution;
  let evolutionRepository: SessionEvolutionRepository;
  let studentRepository: StudentRepository;
  let educatorRepository: EducatorRepository;
  let shareRepository: ReturnType<typeof makeShareRepository>;
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
    educatorRepository = {
      getByIds: vi.fn(async (ids: Uuid[]) =>
        ids.some((id) => id.value === owner.id.value) ? [owner] : []
      ),
    } as unknown as EducatorRepository;
    shareRepository = makeShareRepository();
    useCase = new GetSessionEvolutionUseCase(
      evolutionRepository,
      makeStudentAccess(studentRepository, shareRepository),
      educatorRepository
    );
  });

  it("should return the evolution of the student owner without authorName", async () => {
    const result = await useCase.execute({ educatorId, evolutionId: evolution.id.value });

    expect(result).toEqual({ ok: true, value: { evolution, authorName: undefined } });
    expect(educatorRepository.getByIds).not.toHaveBeenCalled();
  });

  it("should let a colleague the student is shared with read it, with the author's name (EQ-11, EQ-12)", async () => {
    const colleagueId = Uuid.random();
    await shareRepository.create(shareStudent(student, colleagueId));

    const result = await useCase.execute({
      educatorId: colleagueId,
      evolutionId: evolution.id.value,
    });

    expect(result).toEqual({ ok: true, value: { evolution, authorName: "Dona Marta" } });
  });

  it("should return UNAUTHORIZED to the colleague after the share is undone", async () => {
    const colleagueId = Uuid.random();
    await shareRepository.create(shareStudent(student, colleagueId));
    await shareRepository.delete(student.id, colleagueId);

    const result = await useCase.execute({
      educatorId: colleagueId,
      evolutionId: evolution.id.value,
    });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
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
