import { describe, it, expect } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { AnamneseResponse } from "../../domain/entities/anamnese-response";
import { AnamneseQuestionType } from "../../domain/entities/anamnese-template";
import { mapAnamneseResponse } from "./map-anamnese-response";

const response = AnamneseResponse.fromPersistence({
  id: Uuid.random(),
  templateId: Uuid.random(),
  educatorId: Uuid.random(),
  studentId: Uuid.random(),
  answers: [
    { questionId: "q1", questionType: AnamneseQuestionType.Descriptive, textValue: "x" },
  ],
  answeredAt: new Date("2026-11-01T12:00:00.000Z"),
});

describe("mapAnamneseResponse", () => {
  it("keeps the previous JSON shape and adds summaryOutdated", () => {
    const json = JSON.parse(JSON.stringify(mapAnamneseResponse(response)));

    expect(json).toEqual({
      id: response.id.value,
      templateId: response.templateId.value,
      educatorId: response.educatorId.value,
      studentId: response.studentId.value,
      answers: [{ questionId: "q1", questionType: "Descriptive", textValue: "x" }],
      answeredAt: "2026-11-01T12:00:00.000Z",
      summaryOutdated: false,
    });
    // Antes do mapper, a entidade ia direto para o JSON.
    const { summaryOutdated: _, ...previous } = json;
    expect(previous).toEqual(JSON.parse(JSON.stringify(response)));
  });

  it("includes the summary when there is one", () => {
    const generatedAt = new Date("2026-11-10T12:00:00.000Z");
    const json = mapAnamneseResponse(response.withSummary({ text: "Síntese", generatedAt }));

    expect(json.summary).toEqual({ text: "Síntese", generatedAt });
    expect(json.summaryOutdated).toBe(false);
  });
});
