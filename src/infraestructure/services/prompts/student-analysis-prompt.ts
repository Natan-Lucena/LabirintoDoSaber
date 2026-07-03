import { StudentAnalysisAiInput } from "../../../domain/services/ai-student-analysis-service";

const percent = (value: number) => `${Math.round(value * 100)}%`;

function renderMetrics(input: StudentAnalysisAiInput): string {
  const { total, categories } = input.metrics;
  const byCategory = categories
    .map(
      (c) =>
        `  - ${c.category}: ${c.correct}/${c.total} corretas (${percent(
          c.accuracy
        )})`
    )
    .join("\n");

  return `Desempenho geral: ${total.correct}/${total.total} corretas (${percent(
    total.accuracy
  )}).
Por categoria:
${byCategory || "  - (sem dados por categoria)"}`;
}

function renderSessions(input: StudentAnalysisAiInput): string {
  if (!input.sessions.length) {
    return "Nenhuma sessão registrada no período.";
  }

  return input.sessions
    .map((session, index) => {
      const period = session.finishedAt
        ? `${session.startedAt} → ${session.finishedAt}`
        : `${session.startedAt} (não finalizada)`;
      const avg =
        session.averageTimeToAnswer !== undefined
          ? `${session.averageTimeToAnswer.toFixed(1)}s`
          : "n/d";

      const answers = session.answers
        .map(
          (a) =>
            `    • [${a.isCorrect ? "ACERTOU" : "ERROU"}] (${
              a.category ?? "?"
            }, ${a.timeToAnswer}s) ${a.taskPrompt ?? "(enunciado indisponível)"}`
        )
        .join("\n");

      return `Sessão ${index + 1} — "${session.name}"
  Período: ${period}
  Desempenho: ${session.correctAnswers}/${session.totalAnswers} corretas | tempo médio por questão: ${avg}
  Observação do educador: ${session.observation ?? "(nenhuma)"}
  Respostas:
${answers || "    (sem respostas)"}`;
    })
    .join("\n\n");
}

function renderAnamnese(input: StudentAnalysisAiInput): string {
  if (!input.anamnese || !input.anamnese.answers.length) {
    return "";
  }

  const answers = input.anamnese.answers
    .map((a) => `  - ${a.question}\n    R: ${a.answer}`)
    .join("\n");

  return `

DADOS DA ANAMNESE${
    input.anamnese.templateTitle ? ` (${input.anamnese.templateTitle})` : ""
  }:
${answers}`;
}

/**
 * Monta o prompt da análise psicopedagógica do aluno. Recebe o retrato completo
 * já montado pelo use-case e pede uma análise textual longa e rica.
 */
export function buildStudentAnalysisPrompt(
  input: StudentAnalysisAiInput
): string {
  const { student } = input;
  const topics = student.learningTopics.length
    ? student.learningTopics.join(", ")
    : "(não informados)";

  return `Você é um(a) psicopedagogo(a) experiente da plataforma "Labirinto do Saber".
Sua tarefa é produzir uma ANÁLISE PSICOPEDAGÓGICA COMPLETA E APROFUNDADA de um
estudante, com base em todos os dados fornecidos abaixo. O relatório será lido
por profissionais e responsáveis e comporá um documento formal.

PERFIL DO ALUNO:
  - Nome: ${student.name}
  - Idade: ${student.age} anos
  - Gênero: ${student.gender}
  - Temas/objetivos de aprendizagem: ${topics}

MÉTRICAS DE DESEMPENHO:
${renderMetrics(input)}

HISTÓRICO DE SESSÕES:
${renderSessions(input)}${renderAnamnese(input)}

INSTRUÇÕES PARA A ANÁLISE:
Escreva um texto EXTENSO, detalhado e rico (propositalmente longo), em português
do Brasil, com tom profissional, acolhedor e construtivo. Baseie CADA afirmação
nos dados apresentados (cite números, categorias, tempos e padrões observados).
Não invente dados que não existam; quando faltar informação, diga isso de forma
transparente. Organize o relatório EXATAMENTE nas seções abaixo, usando esses
títulos em markdown:

## Visão Geral
Panorama do momento atual do aluno e do período analisado.

## Maiores Acertos e Pontos Fortes
Onde o aluno se destaca, com evidências dos dados.

## Principais Fraquezas e Dificuldades
Categorias/tipos de questão com menor desempenho e possíveis causas.

## Observações de Padrões
Padrões de comportamento e aprendizagem: evolução entre sessões, relação entre
tempo de resposta e acerto, consistência, categorias recorrentes, etc.

## Pontos de Melhoria
Aspectos concretos a desenvolver, priorizados.

## Guia de Intervenção
Plano de ação prático e detalhado: estratégias, atividades sugeridas, frequência
e como acompanhar a evolução. Seja específico e aplicável ao perfil do aluno.

## Considerações Finais
Síntese e recomendações de acompanhamento.`;
}
