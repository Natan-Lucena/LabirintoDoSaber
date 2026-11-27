import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { ApplicationStatus } from "../../../../../domain/entities/scale-application";
import { ListScaleApplicationsUseCase } from "./list-scale-applications-use-case";
import {
  makeApplicationRepository,
  makeDemoTemplate,
  makeStudent,
  makeStudentAccessFor,
  shareStudent,
  makeTemplateRepository,
  startApplication,
} from "../test-fixtures";

describe("ListScaleApplicationsUseCase", () => {
  const educatorId = Uuid.random();
  const ana = makeStudent(educatorId, "Ana");
  const bia = makeStudent(educatorId, "Bia");
  const other = makeStudent(Uuid.random(), "Caio");
  const template = makeDemoTemplate();

  let applicationRepository: ReturnType<typeof makeApplicationRepository>;
  let templateRepository: ReturnType<typeof makeTemplateRepository>;
  let useCase: ListScaleApplicationsUseCase;

  beforeEach(() => {
    applicationRepository = makeApplicationRepository([
      startApplication(template, ana),
      startApplication(template, bia),
    ]);
    templateRepository = makeTemplateRepository([template]);
    useCase = new ListScaleApplicationsUseCase(
      applicationRepository,
      templateRepository,
      makeStudentAccessFor([ana, bia, other])
    );
  });

  it("should list the summaries of the educator's students with score and disclaimer", async () => {
    const result = await useCase.execute({ educatorId, limit: 50 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(applicationRepository.search).toHaveBeenCalledWith({
      studentIds: [ana.id, bia.id],
      status: undefined,
      limit: 50,
    });
    expect(result.value.map((summary) => summary.studentName)).toEqual(["Ana", "Bia"]);
    for (const summary of result.value) {
      expect(summary.disclaimer).toBe("O resultado não substitui avaliação clínica completa.");
      expect(summary.score).toMatchObject({ partial: true, answered: 0, total: 8 });
      expect(summary).not.toHaveProperty("answers");
    }
  });

  it("should load the templates of the used versions in one batch", async () => {
    await useCase.execute({ educatorId, limit: 50 });

    expect(templateRepository.findByIds).toHaveBeenCalledTimes(1);
    expect(templateRepository.findByIds).toHaveBeenCalledWith([template.id]);
    expect(templateRepository.findById).not.toHaveBeenCalled();
  });

  it("should filter by an owned student and status", async () => {
    await useCase.execute({
      educatorId,
      studentId: ana.id.value,
      status: ApplicationStatus.COMPLETED,
      limit: 10,
    });

    expect(applicationRepository.search).toHaveBeenCalledWith({
      studentIds: [ana.id],
      status: ApplicationStatus.COMPLETED,
      limit: 10,
    });
  });

  it("should return UNAUTHORIZED for a student of another educator", async () => {
    const result = await useCase.execute({ educatorId, studentId: other.id.value, limit: 50 });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(applicationRepository.search).not.toHaveBeenCalled();
  });

  it("should return STUDENT_NOT_FOUND for a missing student", async () => {
    const result = await useCase.execute({
      educatorId,
      studentId: Uuid.random().value,
      limit: 50,
    });

    expect(result).toEqual({ ok: false, error: "STUDENT_NOT_FOUND" });
  });

  describe("paciente compartilhado (EQ-11)", () => {
    const colleagueId = Uuid.random();

    beforeEach(() => {
      useCase = new ListScaleApplicationsUseCase(
        applicationRepository,
        templateRepository,
        makeStudentAccessFor([ana, bia, other], [shareStudent(ana, colleagueId)])
      );
    });

    it("lists the applications of the students shared with the colleague", async () => {
      const result = await useCase.execute({ educatorId: colleagueId, limit: 50 });

      expect(result.ok).toBe(true);
      expect(applicationRepository.search).toHaveBeenCalledWith({
        studentIds: [ana.id],
        status: undefined,
        limit: 50,
      });
    });

    it("filters by a shared student and refuses one not shared", async () => {
      const shared = await useCase.execute({
        educatorId: colleagueId,
        studentId: ana.id.value,
        limit: 50,
      });
      expect(shared.ok).toBe(true);

      const notShared = await useCase.execute({
        educatorId: colleagueId,
        studentId: bia.id.value,
        limit: 50,
      });
      expect(notShared).toEqual({ ok: false, error: "UNAUTHORIZED" });
    });
  });
});
