import { AnamneseSummaryParams } from "../../../domain/services/ai-clinical-service";
import { COMMON_RULES, PERSONA } from "./clinical-prompt-rules";

export function buildAnamneseSummaryPrompt(params: AnamneseSummaryParams): string {
  return `${PERSONA}

Tarefa: resumir uma anamnese em tópicos curtos, para o profissional consultar rapidamente.

Contexto (JSON). "anamnese.answers" são os pares pergunta/resposta preenchidos pelo profissional:
"""
${JSON.stringify(params, null, 2)}
"""

Regras OBRIGATÓRIAS:
${COMMON_RULES}
- Organize em tópicos curtos, nesta ordem, cada um iniciado por "- " e com o rótulo:
  Histórico, Queixa, Desenvolvimento, Escola, Pontos de atenção.
- Omita o tópico quando a anamnese não trouxer informação sobre ele.
- Não copie dados de contato, endereços, documentos ou nomes que apareçam nas respostas.
- No máximo 1500 caracteres.

Formato da resposta (será parseada automaticamente):
- Responda SOMENTE com um objeto JSON válido, sem texto antes ou depois, sem markdown:
  { "text": "síntese em tópicos (até 1500 caracteres)" }`;
}
