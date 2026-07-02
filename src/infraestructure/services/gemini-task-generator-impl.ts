import { GoogleGenAI, Type } from "@google/genai";
import {
  AiTaskGeneratorService,
  GenerateTasksParams,
  GeneratedTaskDraft,
} from "../../domain/services/ai-task-generator-service";
import { buildGenerateTasksPrompt } from "./prompts/generate-tasks-prompt";

const MODEL = "gemini-2.5-flash";

const RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      prompt: { type: Type.STRING },
      alternatives: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            text: { type: Type.STRING },
            isCorrect: { type: Type.BOOLEAN },
          },
          required: ["text", "isCorrect"],
        },
      },
    },
    required: ["prompt", "alternatives"],
  },
};

export class GeminiTaskGeneratorImpl implements AiTaskGeneratorService {
  private readonly client: GoogleGenAI;

  constructor(apiKey = process.env.GEMINI_API_KEY) {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY não está definido!");
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  async generate(params: GenerateTasksParams): Promise<GeneratedTaskDraft[]> {
    const prompt = buildGenerateTasksPrompt(params);

    const response = await this.client.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA,
      },
    });

    const text = response.text;

    if (!text) {
      throw new Error("AI_EMPTY_RESPONSE");
    }

    return this.parseResponse(text);
  }

  private parseResponse(raw: string): GeneratedTaskDraft[] {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("AI_INVALID_OUTPUT");
    }

    if (!Array.isArray(parsed)) {
      throw new Error("AI_INVALID_OUTPUT");
    }

    return parsed.map((item) => {
      const draft = item as Partial<GeneratedTaskDraft>;
      if (
        typeof draft.prompt !== "string" ||
        !Array.isArray(draft.alternatives)
      ) {
        throw new Error("AI_INVALID_OUTPUT");
      }

      return {
        prompt: draft.prompt,
        alternatives: draft.alternatives.map((alt) => ({
          text: String(alt.text),
          isCorrect: Boolean(alt.isCorrect),
        })),
      };
    });
  }
}
