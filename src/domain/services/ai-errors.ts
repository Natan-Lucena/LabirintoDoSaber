// Lançado quando o modelo devolve algo que não dá para interpretar (JSON
// quebrado ou fora do formato). O use case traduz para AI_INVALID_OUTPUT.
export class AiInvalidOutputError extends Error {
  constructor() {
    super("AI_INVALID_OUTPUT");
    this.name = "AiInvalidOutputError";
  }
}
