import { GeneratePlanSuggestionsParams } from "../../../domain/services/ai-plan-generator-service";

/**
 * Monta o prompt de sugestões de ajuste para um plano ativo. O contexto não
 * traz nome, endereço, telefone, documentos nem fotos do paciente.
 */
export function buildPlanSuggestionsPrompt(params: GeneratePlanSuggestionsParams): string {
  return `Você é um psicopedagogo experiente que acompanha planos de intervenção na plataforma
"Labirinto do Saber", voltada a crianças com dificuldades de aprendizagem.

Analise o plano atual e o contexto do paciente e sugira ajustes pontuais ao plano.

Plano atual (JSON; datas no formato AAAA-MM-DD; "today" é a data de hoje):
"""
${JSON.stringify(params.plan, null, 2)}
"""

Contexto do paciente (JSON; métricas de acerto vão de 0 a 1):
"""
${JSON.stringify(params.context, null, 2)}
"""

Tipos de sugestão ("kind") permitidos:
- "UPDATE_GOAL_STATUS": mudar o status de uma meta existente. Informe "goalId" e "proposedChange.status"
  (um de NOT_STARTED, IN_PROGRESS, ACHIEVED, DISCONTINUED).
- "ADD_GOAL": incluir uma meta nova. Informe "proposedChange.description" e "proposedChange.successCriterion".
- "REWRITE_GOAL": reescrever uma meta existente. Informe "goalId", "proposedChange.description" e
  "proposedChange.successCriterion".
- "SCHEDULE_REVIEW": marcar a próxima revisão. Informe "proposedChange.nextReviewDate", entre "startDate" e
  "endDate" do plano e não anterior a "today".

Regras OBRIGATÓRIAS:
- Escreva TUDO em português do Brasil.
- Gere NO MÁXIMO ${params.max} sugestão(ões). Gere menos (ou nenhuma) se não houver ajuste justificável.
- Use SOMENTE os ids de meta ("goalId") listados em "goals" do plano atual. Nunca invente ids.
- Cada sugestão deve ter um "text" (até 500 caracteres) explicando o ajuste e o motivo, com base nas
  métricas e observações.
- NÃO faça diagnóstico (não nomeie transtornos nem condições clínicas) e NÃO prometa resultados.
- Não invente dados sobre o paciente que não estejam no contexto.

Formato da resposta (será parseada automaticamente):
- Responda SOMENTE com um objeto JSON válido, sem texto antes ou depois, sem markdown:
  {
    "suggestions": [
      {
        "kind": "UPDATE_GOAL_STATUS | ADD_GOAL | REWRITE_GOAL | SCHEDULE_REVIEW",
        "goalId": "id da meta (só em UPDATE_GOAL_STATUS e REWRITE_GOAL)",
        "text": "explicação da sugestão (até 500 caracteres)",
        "proposedChange": {
          "status": "...",
          "description": "...",
          "successCriterion": "...",
          "nextReviewDate": "AAAA-MM-DD"
        }
      }
    ]
  }`;
}
