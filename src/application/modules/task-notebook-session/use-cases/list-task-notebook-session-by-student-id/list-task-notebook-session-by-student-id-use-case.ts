import { Uuid } from "@wave-telecom/framework/core";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { ActivityResultRepository } from "../../../../../domain/repositories/activity-result-repository";
import { mapActivityResultToResponse } from "../../../../../infraestructure/mappers/map-activity-result";

interface IListTaskNotebookSessionByStudentRequest {
  studentId: string;
}

export class ListTaskNotebookSessionByStudentIdUseCase {
  constructor(
    private taskNotebookSessionRepository: TaskNotebookSessionRepository,
    private sessionEvolutionRepository: SessionEvolutionRepository,
    private activityResultRepository: ActivityResultRepository
  ) {}

  async execute(props: IListTaskNotebookSessionByStudentRequest) {
    const sessions = await this.taskNotebookSessionRepository.listByStudentId(
      new Uuid(props.studentId)
    );

    // EV-11: uma consulta em lote para saber quais sessões já têm evolução.
    const sessionIds = sessions.map((session) => session.id);
    const evolutionIds = await this.sessionEvolutionRepository.findIdsBySessionIds(
      sessionIds
    );

    // RS-07: resultados de jogo de todas as sessões numa consulta só.
    const results = await this.activityResultRepository.listBySessionIds(sessionIds);
    const resultsBySession = new Map<string, ReturnType<typeof mapActivityResultToResponse>[]>();
    for (const result of results) {
      const list = resultsBySession.get(result.sessionId.value) ?? [];
      list.push(mapActivityResultToResponse(result));
      resultsBySession.set(result.sessionId.value, list);
    }

    return sessions.map((session) => ({
      ...session,
      evolutionId: evolutionIds.get(session.id.value),
      activityResults: resultsBySession.get(session.id.value) ?? [],
    }));
  }
}
