import { describe, it, expect } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { ScaleApplication } from "../../domain/entities/scale-application";
import {
  demoAnswers,
  makeDemoTemplate,
} from "../../domain/tests/entities/scale-fixtures";
import {
  mapScaleApplicationToResponse,
  mapScaleApplicationToSummary,
  mapScaleTemplateToSummary,
} from "./map-scale";

const unwrap = <T>(result: { ok: boolean; value?: T; error?: unknown }): T => {
  if (!result.ok) throw new Error(`unexpected ${JSON.stringify(result.error)}`);
  return result.value as T;
};

const template = makeDemoTemplate();
const draft = unwrap<ScaleApplication>(
  ScaleApplication.start({ template, studentId: Uuid.random(), educatorId: Uuid.random() })
);
const completed = unwrap<ScaleApplication>(
  unwrap<ScaleApplication>(
    draft.saveAnswers(template, demoAnswers([3, 3, 3, 3, 3, 3, 3, 3]))
  ).complete(template)
);

// Ida e volta em JSON, como o app recebe.
const asJson = (value: unknown) => JSON.parse(JSON.stringify(value));

describe("map-scale", () => {
  it("should always send the disclaimer (AV-09)", () => {
    for (const application of [draft, completed]) {
      expect(mapScaleApplicationToResponse(application, template, "Ana").disclaimer).toBe(
        "O resultado não substitui avaliação clínica completa."
      );
      expect(mapScaleApplicationToSummary(application, template, "Ana").disclaimer).toBe(
        "O resultado não substitui avaliação clínica completa."
      );
    }
  });

  it("should recalculate the score from the answers", () => {
    const response = mapScaleApplicationToResponse(completed, template, "Ana");

    expect(response.score).toMatchObject({ partial: false, answered: 8, value: 24, max: 24 });
    expect(response.score.band?.severity).toBe("HIGH");
    expect(response.answers).toHaveLength(8);
  });

  it("should leave undefined optionals out of the JSON and the answers out of the summary", () => {
    const response = asJson(mapScaleApplicationToResponse(draft, template, "Ana"));
    const summary = asJson(mapScaleApplicationToSummary(draft, template, "Ana"));

    expect(response).not.toHaveProperty("appointmentId");
    expect(response).not.toHaveProperty("insight");
    expect(response).not.toHaveProperty("completedAt");
    expect(response.score).not.toHaveProperty("band");
    expect(response.answers).toEqual([]);
    expect(summary).not.toHaveProperty("answers");
    expect(summary.studentName).toBe("Ana");
  });

  it("should summarize a template with itemCount and without items", () => {
    const summary = mapScaleTemplateToSummary(template);

    expect(summary).toMatchObject({ code: "DEMO-RASTREIO", itemCount: 8, estimatedMinutes: 5 });
    expect(summary).not.toHaveProperty("items");
  });
});
