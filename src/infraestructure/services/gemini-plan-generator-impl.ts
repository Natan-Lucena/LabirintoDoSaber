import { GoogleGenAI, Type } from "@google/genai";
import {
  AiInvalidOutputError,
  AiPlanGeneratorService,
  GeneratePlanDraftParams,
  PlanDraftOutput,
} from "../../domain/services/ai-plan-generator-service";
import { buildGeneratePlanPrompt } from "./prompts/generate-plan-prompt";
import { withGeminiRetry } from "./gemini-retry";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    generalObjective: { type: Type.STRING },
    goals: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          description: { type: Type.STRING },
          successCriterion: { type: Type.STRING },
        },
        required: ["description"],
      },
    },
    rationale: { type: Type.STRING },
  },
  required: ["title", "generalObjective", "goals"],
};

export class GeminiPlanGeneratorImpl implements AiPlanGeneratorService {
  private readonly client: GoogleGenAI;

  constructor(apiKey = process.env.GEMINI_API_KEY) {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY não está definido!");
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  async generateDraft(params: GeneratePlanDraftParams): Promise<PlanDraftOutput> {
    const prompt = buildGeneratePlanPrompt(params);

    // Nunca logar o prompt nem a resposta: trazem dados do paciente.
    console.log(`[GeminiPlanGenerator] calling ${MODEL} for ${params.type}`);

    const response = await withGeminiRetry(
      () =>
        this.client.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: RESPONSE_SCHEMA,
          },
        }),
      // 2 tentativas para caber no tempo da função na Vercel e no corte de 90 s do app.
      { label: "GeminiPlanGenerator", attempts: 2 }
    );

    const text = response.text;
    if (!text) {
      console.error("[GeminiPlanGenerator] empty response", {
        finishReason: (response as any)?.candidates?.[0]?.finishReason,
      });
      throw new AiInvalidOutputError();
    }

    return this.parseResponse(text);
  }

  private parseResponse(raw: string): PlanDraftOutput {
    let parsed: any;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new AiInvalidOutputError();
    }

    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.title !== "string" ||
      typeof parsed.generalObjective !== "string" ||
      !Array.isArray(parsed.goals)
    ) {
      throw new AiInvalidOutputError();
    }

    return {
      title: parsed.title,
      generalObjective: parsed.generalObjective,
      goals: parsed.goals.map((goal: any) => ({
        description: typeof goal?.description === "string" ? goal.description : "",
        successCriterion:
          typeof goal?.successCriterion === "string"
            ? goal.successCriterion
            : undefined,
      })),
      rationale: typeof parsed.rationale === "string" ? parsed.rationale : undefined,
    };
  }
}
