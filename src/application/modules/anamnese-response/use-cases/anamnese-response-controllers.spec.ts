// POST e PUT devolvem o mesmo JSON que o GET, com summaryOutdated (Swagger).
import { describe, it, expect, vi } from "vitest";
import { success, Uuid } from "@wave-telecom/framework/core";
import { AnamneseResponse } from "../../../../domain/entities/anamnese-response";
import { AnamneseQuestionType } from "../../../../domain/entities/anamnese-template";
import { SubmitAnamneseResponseController } from "./submit-anamnese-response/submit-anamnese-response-controller";
import { runController } from "../../controller-test-helper";
import { UpdateAnamneseResponseController } from "./update-anamnese-response/update-anamnese-response-controller";

const summaryAt = new Date("2026-11-10T12:00:00.000Z");
const response = AnamneseResponse.fromPersistence({
  id: Uuid.random(),
  templateId: Uuid.random(),
  educatorId: Uuid.random(),
  studentId: Uuid.random(),
  answers: [
    { questionId: "q1", questionType: AnamneseQuestionType.Descriptive, textValue: "x" },
  ],
  answeredAt: new Date("2026-11-01T12:00:00.000Z"),
  // Editada depois da síntese.
  updatedAt: new Date("2026-11-11T12:00:00.000Z"),
  summary: { text: "Síntese", generatedAt: summaryAt },
});

const run = (controller: any, req: object) => runController(controller, req);

const body = { studentId: response.studentId.value, answers: [] };

describe("anamnese response controllers", () => {
  for (const [route, Controller, req] of [
    [
      "POST /anamnese/templates/:templateId/responses",
      SubmitAnamneseResponseController,
      { params: { templateId: response.templateId.value }, body },
    ],
    [
      "PUT /anamnese/responses/:responseId",
      UpdateAnamneseResponseController,
      { params: { responseId: response.id.value }, body: { answers: [] } },
    ],
  ] as const) {
    it(`${route} should answer with summary and summaryOutdated`, async () => {
      const useCase = { execute: vi.fn().mockResolvedValue(success(response)) };

      const { status, body: json } = await run(new (Controller as any)(useCase), req);

      expect(status).toBe(200);
      expect(json).toEqual({
        id: response.id.value,
        templateId: response.templateId.value,
        educatorId: response.educatorId.value,
        studentId: response.studentId.value,
        answers: [{ questionId: "q1", questionType: "Descriptive", textValue: "x" }],
        answeredAt: "2026-11-01T12:00:00.000Z",
        updatedAt: "2026-11-11T12:00:00.000Z",
        summary: { text: "Síntese", generatedAt: summaryAt.toISOString() },
        summaryOutdated: true,
      });
    });
  }
});
