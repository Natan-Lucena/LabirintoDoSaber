import { PlanType } from "../../../domain/entities/plan";
import { GeneratePlanDraftParams } from "../../../domain/services/ai-plan-generator-service";

const describePlanType = (params: GeneratePlanDraftParams): string => {
  if (params.type === PlanType.PDI) {
    return `PDI (Plano de Desenvolvimento Individual): plano de médio prazo, com duração de ${params.durationMonths} meses.
As metas devem ser alcançáveis ao longo desse período e acompanhadas em revisões mensais.`;
  }

  const base = `PE (Plano de Sessão): plano para UMA única sessão de atendimento.
As metas devem ser alcançáveis e observáveis dentro dessa sessão.`;

  return params.context.parentGoals?.length
    ? `${base}
Derive as metas da sessão a partir das metas do PDI de origem (listadas no contexto em "parentGoals"),
escolhendo os passos concretos que fazem sentido trabalhar agora.`
    : base;
};

/**
 * Monta o prompt do rascunho de plano (PDI ou PE). O contexto não traz nome,
 * endereço, telefone, documentos nem fotos do paciente.
 */
export function buildGeneratePlanPrompt(params: GeneratePlanDraftParams): string {
  const historyRule = params.context.hasSessionHistory
    ? ""
    : `
- Este paciente AINDA NÃO TEM sessões registradas. Baseie o plano no foco, nas dificuldades consideradas
  e na anamnese (se houver), e diga explicitamente no "rationale" que o plano foi gerado sem histórico de sessões.`;

  return `Você é um psicopedagogo experiente que elabora planos de intervenção para a plataforma
"Labirinto do Saber", voltada ao acompanhamento de crianças com dificuldades de aprendizagem.

Tipo de plano: ${describePlanType(params)}

Contexto do paciente (JSON; métricas de acerto vão de 0 a 1):
"""
${JSON.stringify(params.context, null, 2)}
"""

Regras OBRIGATÓRIAS:
- Escreva TUDO em português do Brasil.
- Gere de 3 a 6 metas específicas, observáveis e mensuráveis, cada uma com um critério de sucesso claro.
- As metas devem partir do foco e das dificuldades consideradas, usando as métricas, as observações e a anamnese como apoio.
- NÃO faça diagnóstico (não nomeie transtornos nem condições clínicas) e NÃO prometa resultados.
- Não invente dados sobre o paciente que não estejam no contexto.
- Não inclua datas; o sistema calcula as datas do plano.${historyRule}

Formato da resposta (será parseada automaticamente):
- Responda SOMENTE com um objeto JSON válido, sem texto antes ou depois, sem markdown:
  {
    "title": "título curto do plano (até 120 caracteres)",
    "generalObjective": "objetivo geral do plano (até 2000 caracteres)",
    "goals": [
      { "description": "meta (até 500 caracteres)", "successCriterion": "como saber que a meta foi atingida (até 500 caracteres)" }
    ],
    "rationale": "justificativa breve das escolhas (até 1000 caracteres)"
  }`;
}
