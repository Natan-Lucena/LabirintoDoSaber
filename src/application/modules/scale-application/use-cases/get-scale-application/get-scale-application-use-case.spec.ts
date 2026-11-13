import { describe, it, expect, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { ScaleApplication } from "../../../../../domain/entities/scale-application";
import { BandSeverity } from "../../../../../domain/entities/scale-template";
import { mapScaleApplicationToResponse } from "../../../../../infraestructure/mappers/map-scale";
import { GetScaleApplicationUseCase } from "./get-scale-application-use-case";
import {
  demoAnswers,
  makeApplicationRepository,
  makeDemoTemplate,
  makeStudent,
  makeStudentRepository,
  makeTemplateRepository,
  startApplication,
  unwrap,
} from "../test-fixtures";

describe("GetScaleApplicationUseCase", () => {
  const educatorId = Uuid.random();
  const student = makeStudent(educatorId, "Ana");
  const v1 = makeDemoTemplate();
  // Versão 2 com faixas mais rígidas: 12 pontos já seria HIGH.
  const v2 = makeDemoTemplate({
    version: 2,
    scoring: {
      ...v1.scoring,
      bands: [
        ...v1.scoring.bands.filter((band) => band.subscaleCode),
        { min: 0, max: 4, label: "Baixa", severity: BandSeverity.LOW },
        { min: 5, max: 8, label: "Moderada", severity: BandSeverity.MODERATE },
        { min: 9, max: 24, label: "Alta", severity: BandSeverity.HIGH },
      ],
    },
  });

  let application: ScaleApplication;
  let templateRepository: ReturnType<typeof makeTemplateRepository>;
  let useCase: GetScaleApplicationUseCase;

  beforeEach(() => {
    application = unwrap<ScaleApplication>(
      startApplication(v1, student).saveAnswers(v1, demoAnswers([2, 2, 1, 1, 2, 1, 1, 2]))
    );
    templateRepository = makeTemplateRepository([v1, v2]);
    useCase = new GetScaleApplicationUseCase(
      makeApplicationRepository([application]),
      templateRepository,
      makeStudentRepository([student])
    );
  });

  it("should return the application with the student name and the recorded template", async () => {
    const result = await useCase.execute({ educatorId, applicationId: application.id.value });

    expect(result).toEqual({
      ok: true,
      value: { application, template: v1, studentName: "Ana" },
    });
  });

  it("should score an old application with the recorded version (BE-AV-06)", async () => {
    const result = await useCase.execute({ educatorId, applicationId: application.id.value });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(templateRepository.findById).toHaveBeenCalledWith(application.templateId);
    const response = mapScaleApplicationToResponse(
      result.value.application,
      result.value.template,
      result.value.studentName
    );
    expect(response.templateVersion).toBe(1);
    expect(response.score.value).toBe(12);
    expect(response.score.band?.severity).toBe(BandSeverity.MODERATE);
    expect(v2.computeScore(application.answers).band?.severity).toBe(BandSeverity.HIGH);
  });

  it("should return UNAUTHORIZED for another educator (BE-AV-07)", async () => {
    const result = await useCase.execute({
      educatorId: Uuid.random(),
      applicationId: application.id.value,
    });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
  });

  it("should return APPLICATION_NOT_FOUND for a missing application or an invalid id", async () => {
    expect(await useCase.execute({ educatorId, applicationId: "123" })).toEqual({
      ok: false,
      error: "APPLICATION_NOT_FOUND",
    });
    expect(
      await useCase.execute({ educatorId, applicationId: Uuid.random().value })
    ).toEqual({ ok: false, error: "APPLICATION_NOT_FOUND" });
  });
});
