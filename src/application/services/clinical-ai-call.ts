import { failure, success } from "@wave-telecom/framework/core";
import { AiInvalidOutputError } from "../../domain/services/ai-errors";

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

// Corta o texto do modelo no limite, no último espaço ou quebra de linha
// antes dele, para não partir palavra. Sem espaço nenhum, corta no limite.
// Texto ausente ou só com espaços vira "".
export function clipAiText(value: unknown, max: number): string {
  if (typeof value !== "string") return "";
  const text = value.trim();
  if (text.length <= max) return text;

  const cut = text.slice(0, max);
  // Se o próximo caractere já é espaço, o corte caiu entre palavras.
  if (/\s/.test(text[max])) return cut.trimEnd();

  const lastBreak = cut.search(/\s\S*$/);
  return (lastBreak > 0 ? cut.slice(0, lastBreak) : cut).trimEnd();
}
