import { GoogleGenAI } from "@google/genai";
import {
  AiStudentAnalysisService,
  StudentAnalysisAiInput,
} from "../../domain/services/ai-student-analysis-service";
import { buildStudentAnalysisPrompt } from "./prompts/student-analysis-prompt";
import { withGeminiRetry } from "./gemini-retry";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

export class GeminiStudentAnalysisImpl implements AiStudentAnalysisService {
  private readonly client: GoogleGenAI;

  constructor(apiKey = process.env.GEMINI_API_KEY) {
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY não está definido!");
    }
    this.client = new GoogleGenAI({ apiKey });
  }

  async generate(input: StudentAnalysisAiInput): Promise<string> {
    const prompt = buildStudentAnalysisPrompt(input);

    console.log(
      `[GeminiStudentAnalysis] calling ${MODEL} (prompt ${prompt.length} chars)`
    );

    try {
      const response = await withGeminiRetry(
        () =>
          this.client.models.generateContent({
            model: MODEL,
            contents: prompt,
            config: {
              temperature: 0.7,
            },
          }),
        { label: "GeminiStudentAnalysis" }
      );

      const text = response.text;

      if (!text || !text.trim()) {
        console.error("[GeminiStudentAnalysis] empty response", {
          finishReason: (response as any)?.candidates?.[0]?.finishReason,
          promptFeedback: (response as any)?.promptFeedback,
          usage: (response as any)?.usageMetadata,
        });
        throw new Error("AI_EMPTY_RESPONSE");
      }

      console.log(
        `[GeminiStudentAnalysis] ok (${text.trim().length} chars returned)`
      );
      return text.trim();
    } catch (err) {
      console.error("[GeminiStudentAnalysis] generateContent failed:", err);
      throw err;
    }
  }
}
