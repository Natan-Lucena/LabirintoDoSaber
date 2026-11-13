import { GoogleGenAI, Type } from "@google/genai";
import { AiInvalidOutputError } from "../../domain/services/ai-errors";
import {
  AiClinicalService,
  AnamneseSummaryParams,
  ClinicalTextOutput,
  NextSessionSuggestionOutput,
  NextSessionSuggestionParams,
  ReportSynthesisParams,
  ScaleInsightParams,
} from "../../domain/services/ai-clinical-service";
import { buildAnamneseSummaryPrompt } from "./prompts/anamnese-summary-prompt";
import { buildNextSessionSuggestionPrompt } from "./prompts/next-session-suggestion-prompt";
import { buildScaleInsightPrompt } from "./prompts/scale-insight-prompt";
import { buildReportSynthesisPrompt } from "./prompts/report-synthesis-prompt";
import { withGeminiRetry } from "./gemini-retry";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const LABEL = "GeminiClinical";
const ATTEMPT_TIMEOUT_MS = 40_000;

const SUGGESTION_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    suggestion: { type: Type.STRING },
    rationale: { type: Type.STRING },
  },
  required: ["suggestion"],
};

const TEXT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    text: { type: Type.STRING },
  },
  required: ["text"],
};

export class GeminiClinicalImpl implements AiClinicalService {
  private readonly client: GoogleGenAI;

  constructor(apiKey = process.env.GEMINI_API_KEY) {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY não está definido!");
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  async nextSessionSuggestion(
    params: NextSessionSuggestionParams
  ): Promise<NextSessionSuggestionOutput> {
    const parsed = await this.generate(
      "next-session-suggestion",
      buildNextSessionSuggestionPrompt(params),
      SUGGESTION_SCHEMA
    );
    if (typeof parsed.suggestion !== "string") throw new AiInvalidOutputError();

    return {
      suggestion: parsed.suggestion,
      rationale: typeof parsed.rationale === "string" ? parsed.rationale : undefined,
    };
  }

  async scaleInsight(params: ScaleInsightParams): Promise<ClinicalTextOutput> {
    return this.generateText("scale-insight", buildScaleInsightPrompt(params));
  }

  async anamneseSummary(params: AnamneseSummaryParams): Promise<ClinicalTextOutput> {
    return this.generateText("anamnese-summary", buildAnamneseSummaryPrompt(params));
  }

  async reportSynthesis(params: ReportSynthesisParams): Promise<ClinicalTextOutput> {
    return this.generateText("report-synthesis", buildReportSynthesisPrompt(params));
  }

  private async generateText(kind: string, prompt: string): Promise<ClinicalTextOutput> {
    const parsed = await this.generate(kind, prompt, TEXT_SCHEMA);
    if (typeof parsed.text !== "string") throw new AiInvalidOutputError();
    return { text: parsed.text };
  }

  private async generate(kind: string, prompt: string, responseSchema: object) {
    // Nunca logar o prompt nem a resposta: trazem dados do paciente.
    console.log(`[${LABEL}] calling ${MODEL} for ${kind}`);

    const response = await withGeminiRetry(
      () =>
        this.client.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema,
            // Por tentativa: 2 × 40 s + backoff cabem no corte de 90 s do app.
            httpOptions: { timeout: ATTEMPT_TIMEOUT_MS },
            // Textos curtos: sem raciocínio estendido, para responder rápido (IA-06).
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      // 2 tentativas para caber no tempo da função na Vercel e no corte de 90 s do app.
      { label: LABEL, attempts: 2 }
    );

    const text = response.text;
    if (!text) {
      console.error(`[${LABEL}] empty response`, {
        finishReason: (response as any)?.candidates?.[0]?.finishReason,
      });
      throw new AiInvalidOutputError();
    }

    let parsed: any;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new AiInvalidOutputError();
    }
    if (!parsed || typeof parsed !== "object") throw new AiInvalidOutputError();

    return parsed as Record<string, unknown>;
  }
}
