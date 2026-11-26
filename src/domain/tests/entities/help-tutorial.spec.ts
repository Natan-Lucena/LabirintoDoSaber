import { describe, it, expect } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { HelpTutorial } from "../../entities/help-tutorial";

const valid = () => ({
  id: Uuid.random(),
  order: 1,
  title: "Conheça o Labirinto do Saber",
  description: "Um passeio pelas telas principais.",
  durationSeconds: 60,
  featured: true,
  steps: ["Abra o app.", "Toque em Pacientes."],
});

const errorsOf = (props: Parameters<typeof HelpTutorial.create>[0]) => {
  const result = HelpTutorial.create(props);
  if (result.ok) throw new Error("esperava falha");
  expect(result.error.code).toBe("INVALID_HELP_TUTORIAL");
  return result.error.errors;
};

describe("HelpTutorial", () => {
  it("should create a text tutorial without video (AJ-03)", () => {
    const result = HelpTutorial.create(valid());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.videoUrl).toBeUndefined();
    expect(result.value.steps).toEqual(["Abra o app.", "Toque em Pacientes."]);
  });

  it("should accept an https MP4 or HLS video and an https thumbnail (AJ-02)", () => {
    for (const videoUrl of [
      "https://cdn.exemplo.com/ajuda/intro.mp4",
      "https://cdn.exemplo.com/ajuda/intro.m3u8",
    ]) {
      const result = HelpTutorial.create({
        ...valid(),
        steps: undefined,
        videoUrl,
        thumbnailUrl: "https://cdn.exemplo.com/ajuda/intro.jpg",
      });
      expect(result.ok).toBe(true);
    }
  });

  it("should reject a video that is not https or not MP4/HLS", () => {
    expect(errorsOf({ ...valid(), videoUrl: "http://cdn.exemplo.com/a.mp4" })).toEqual([
      expect.stringContaining("videoUrl"),
    ]);
    expect(errorsOf({ ...valid(), videoUrl: "https://youtube.com/watch?v=1" })).toEqual([
      expect.stringContaining("videoUrl"),
    ]);
    expect(errorsOf({ ...valid(), thumbnailUrl: "ftp://x/a.jpg" })).toEqual([
      expect.stringContaining("thumbnailUrl"),
    ]);
  });

  it("should enforce the size limits", () => {
    const errors = errorsOf({
      ...valid(),
      title: "a".repeat(81),
      description: "a".repeat(201),
      steps: Array.from({ length: 11 }, () => "passo"),
    });

    expect(errors).toEqual([
      expect.stringContaining("title"),
      expect.stringContaining("description"),
      expect.stringContaining("steps"),
    ]);
  });

  it("should reject a tutorial without video and without steps", () => {
    expect(errorsOf({ ...valid(), steps: [] })).toEqual([expect.stringContaining("steps")]);
  });

  it("should reject empty texts, empty steps and invalid numbers", () => {
    const errors = errorsOf({
      ...valid(),
      title: "  ",
      description: "",
      order: 1.5,
      durationSeconds: -1,
      steps: ["ok", " "],
    });

    expect(errors).toHaveLength(5);
  });
});
