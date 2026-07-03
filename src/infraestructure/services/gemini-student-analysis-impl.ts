import { GoogleGenAI } from "@google/genai";
import {
  AiStudentAnalysisService,
  StudentAnalysisAiInput,
} from "../../domain/services/ai-student-analysis-service";
import { buildStudentAnalysisPrompt } from "./prompts/student-analysis-prompt";

const MODEL = "gemini-2.5-flash";

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

    const response = await this.client.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        temperature: 0.7,
      },
    });

    const text = response.text;

    if (!text || !text.trim()) {
      throw new Error("AI_EMPTY_RESPONSE");
    }

    return text.trim();
  }
}
