import { ScaleInsightParams } from "../../../domain/services/ai-clinical-service";
import { COMMON_RULES, PERSONA } from "./clinical-prompt-rules";

export function buildScaleInsightPrompt(params: ScaleInsightParams): string {
  const status = params.preliminary
    ? `A aplicação ainda é um RASCUNHO (${params.score.answered} de ${params.score.total} itens respondidos).
Deixe claro no texto que o insight é preliminar e pode mudar quando a escala for concluída.
A faixa foi calculada só sobre os itens respondidos e pode subestimar o resultado final:
não trate a faixa parcial como definitiva.`
    : "A aplicação foi concluída.";

  return `${PERSONA}

Tarefa: escrever um insight curto sobre o resultado de uma escala de rastreio.

${status}

Contexto (JSON). "scale.bands" são as faixas da escala (sem "subscaleCode" é a faixa do escore
total); "score" é o escore calculado pelo sistema, com as subescalas:
"""
${JSON.stringify(params, null, 2)}
"""

Regras OBRIGATÓRIAS:
${COMMON_RULES}
- Escala de rastreio não é diagnóstico: o resultado não substitui avaliação clínica completa.
- Interprete o escore e as faixas de forma descritiva e sugira o que observar ou aprofundar.
- No máximo 800 caracteres.

Formato da resposta (será parseada automaticamente):
- Responda SOMENTE com um objeto JSON válido, sem texto antes ou depois, sem markdown:
  { "text": "insight (até 800 caracteres)" }`;
}
