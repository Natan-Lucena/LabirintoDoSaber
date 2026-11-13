import { Uuid } from "@wave-telecom/framework/core";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";

interface IListTaskNotebookSessionByStudentRequest {
  studentId: string;
}

export class ListTaskNotebookSessionByStudentIdUseCase {
  constructor(
    private taskNotebookSessionRepository: TaskNotebookSessionRepository,
    private sessionEvolutionRepository: SessionEvolutionRepository
  ) {}

  async execute(props: IListTaskNotebookSessionByStudentRequest) {
    const sessions = await this.taskNotebookSessionRepository.listByStudentId(
      new Uuid(props.studentId)
    );

    // EV-11: uma consulta em lote para saber quais sessões já têm evolução.
    const evolutionIds = await this.sessionEvolutionRepository.findIdsBySessionIds(
      sessions.map((session) => session.id)
    );

    return sessions.map((session) => ({
      ...session,
      evolutionId: evolutionIds.get(session.id.value),
    }));
  }
}
