import { failure, success } from "@wave-telecom/framework/core";
import { AiInvalidOutputError } from "../../domain/services/ai-plan-generator-service";

// Chama a IA e converte as exceções em código (AI_INVALID_OUTPUT ou
// AI_GENERATION_FAILED). O log leva só o código e o status: a mensagem do
// provedor pode ecoar o prompt, que traz dados clínicos.
export async function callClinicalAi<T>(label: string, call: () => Promise<T>) {
  try {
    return success(await call());
  } catch (err) {
    if (err instanceof AiInvalidOutputError) {
      return failure("AI_INVALID_OUTPUT" as const);
    }
    const { name, code, status } = (err ?? {}) as {
      name?: string;
      code?: string;
      status?: number;
    };
    console.error(`[${label}] AI call failed`, { code: code ?? name, status });
    return failure("AI_GENERATION_FAILED" as const);
  }
}

// Corta o texto do modelo no limite; texto ausente ou só com espaços vira "".
export const clipAiText = (value: unknown, max: number): string =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
