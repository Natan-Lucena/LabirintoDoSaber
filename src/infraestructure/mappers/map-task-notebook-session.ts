import {
  TaskNotebookSession,
  timeToAnswerInMs,
} from "../../domain/entities/task-notebook-session";

// O mesmo JSON que a entidade já tinha, com timeToAnswerMs em cada resposta:
// timeToAnswer fica como foi gravado (segundos nas respostas antigas) e
// timeToAnswerMs vem normalizado (PP-08).
export function mapTaskNotebookSessionToResponse(session: TaskNotebookSession) {
  return {
    ...session,
    answers: session.answers.map((answer) => ({
      ...answer,
      timeToAnswerMs: timeToAnswerInMs(answer),
    })),
  };
}
