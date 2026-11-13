import { NextSessionSuggestionParams } from "../../../domain/services/ai-clinical-service";
import { COMMON_RULES, PERSONA } from "./clinical-prompt-rules";

export function buildNextSessionSuggestionPrompt(params: NextSessionSuggestionParams): string {
  return `${PERSONA}

Tarefa: sugerir o que trabalhar na PRÓXIMA sessão, a partir da sessão que acabou de terminar.

Contexto (JSON). "session" traz o acerto nas atividades da sessão; "criteria" traz o resultado
de cada critério avaliado pelo profissional; "recentEvolutions" resume as últimas evoluções
registradas (critérios atingidos sobre o total e um trecho do registro); "planGoals" são as
metas abertas do plano em vigor, quando houver:
"""
${JSON.stringify(params, null, 2)}
"""

Regras OBRIGATÓRIAS:
${COMMON_RULES}
- Proponha atividades ou focos concretos e observáveis, ligados às metas e aos critérios.
- Se o contexto for pequeno, faça uma sugestão simples e diga o que convém observar.

Formato da resposta (será parseada automaticamente):
- Responda SOMENTE com um objeto JSON válido, sem texto antes ou depois, sem markdown:
  {
    "suggestion": "sugestão para a próxima sessão (até 1000 caracteres)",
    "rationale": "justificativa breve, apontando os dados que apoiam a sugestão (até 500 caracteres)"
  }`;
}
