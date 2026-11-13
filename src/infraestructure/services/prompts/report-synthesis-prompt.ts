import { ReportAudience } from "../../../domain/entities/report";
import { ReportSynthesisParams } from "../../../domain/services/ai-clinical-service";
import { COMMON_RULES, PERSONA } from "./clinical-prompt-rules";

const AUDIENCE_GUIDANCE: Record<ReportAudience, string> = {
  [ReportAudience.FAMILY]: `- O texto será lido pela FAMÍLIA da criança: use linguagem simples e acolhedora, frases curtas, sem jargão técnico (explique qualquer termo necessário com palavras do dia a dia).
- Destaque conquistas e próximos passos de forma clara, sem alarmar.`,
  [ReportAudience.SCHOOL]: `- O texto será lido pela ESCOLA (professores e coordenação): use linguagem clara e objetiva, com foco no desempenho e em como apoiar a criança em sala de aula.`,
  [ReportAudience.PROFESSIONAL]: `- O texto será lido por OUTRO PROFISSIONAL da área: use linguagem técnica e objetiva, citando os dados do período.`,
};

export function buildReportSynthesisPrompt(params: ReportSynthesisParams): string {
  return `${PERSONA}

Tarefa: escrever a síntese de um relatório sobre o acompanhamento de uma criança no período informado.

Contexto (JSON). Traz só as seções escolhidas para o relatório. "sessionMetrics.accuracy" e
"byCategory[].accuracy" são frações de 0 a 1; "planProgress[].percent" vai de 0 a 100:
"""
${JSON.stringify(params, null, 2)}
"""

Regras OBRIGATÓRIAS:
${COMMON_RULES}
${AUDIENCE_GUIDANCE[params.audience]}
- Refira-se à criança como "a criança"; não use nomes.
- Resuma o período: o que avançou, o que ainda pede atenção e sugestões de apoio.
- Quando houver escalas, descreva o resultado como rastreio, sem transformá-lo em diagnóstico.
- Texto corrido em até 3 parágrafos curtos, sem markdown.
- No máximo 2500 caracteres.

Formato da resposta (será parseada automaticamente):
- Responda SOMENTE com um objeto JSON válido, sem texto antes ou depois, sem markdown:
  { "text": "síntese do relatório (até 2500 caracteres)" }`;
}
