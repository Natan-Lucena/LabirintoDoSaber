import { TaskCategory } from "../../../domain/entities/task";
import { GenerateTasksParams } from "../../../domain/services/ai-task-generator-service";

const CATEGORY_DESCRIPTIONS: Record<TaskCategory, string> = {
  [TaskCategory.Reading]:
    "Leitura: decodificação, fluência, reconhecimento de palavras e associação som-letra.",
  [TaskCategory.Writing]:
    "Escrita: ortografia, consciência fonológica, construção de frases e uso da língua.",
  [TaskCategory.Vocabulary]:
    "Vocabulário: significado de palavras, sinônimos, antônimos e ampliação lexical.",
  [TaskCategory.Comprehension]:
    "Compreensão: interpretação de texto, inferência, ideia central e relação de sentido.",
};

/**
 * Monta o prompt enviado ao modelo. Recebe APENAS as entradas do use-case.
 * O prompt tem cunho psicopedagógico e descreve explicitamente a estrutura
 * JSON parseável que o modelo deve devolver.
 */
export function buildGenerateTasksPrompt(params: GenerateTasksParams): string {
  const categoryDescription = CATEGORY_DESCRIPTIONS[params.category];

  return `Você é um especialista em psicopedagogia que elabora atividades pedagógicas
para a plataforma "Labirinto do Saber", voltada ao acompanhamento de estudantes
com dificuldades de aprendizagem e diferentes perfis de deficiência.

Seu objetivo é criar atividades de MÚLTIPLA ESCOLHA inclusivas, acolhedoras e
adequadas ao público-alvo descrito, sempre respeitando princípios psicopedagógicos:
- Use linguagem clara, objetiva e adequada à faixa etária e ao perfil informado.
- Adapte o grau de dificuldade e o vocabulário às limitações e potencialidades descritas.
- Evite ambiguidades, pegadinhas e duplo sentido; o enunciado deve ser autoexplicativo.
- Produza alternativas plausíveis, sem opções absurdas ou ofensivas.
- Favoreça o reforço positivo e a autonomia do estudante.

Categoria pedagógica das atividades: ${params.category} — ${categoryDescription}

Público-alvo (idade, perfil de deficiência, dificuldades):
"""
${params.targetAudience}
"""

Instruções do profissional sobre como as atividades devem ser:
"""
${params.instructions}
"""

Gere EXATAMENTE ${params.quantity} atividade(s).

Regras OBRIGATÓRIAS de estrutura (a resposta será parseada automaticamente):
- Responda SOMENTE com um array JSON válido, sem texto antes ou depois, sem markdown.
- Cada item do array deve ter a forma:
  {
    "prompt": "enunciado da atividade",
    "alternatives": [
      { "text": "texto da alternativa", "isCorrect": true },
      { "text": "texto da alternativa", "isCorrect": false }
    ]
  }
- Cada atividade deve ter no MÍNIMO 2 alternativas.
- Cada atividade deve ter EXATAMENTE 1 alternativa com "isCorrect": true; as demais devem ser false.
- Não inclua identificadores, categoria, tipo, nem campos de mídia; apenas "prompt" e "alternatives".`;
}
