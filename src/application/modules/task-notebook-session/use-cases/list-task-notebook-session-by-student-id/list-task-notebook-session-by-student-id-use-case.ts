import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { ActivityResultRepository } from "../../../../../domain/repositories/activity-result-repository";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { mapTaskNotebookSessionToResponse } from "../../../../../infraestructure/mappers/map-task-notebook-session";
import { mapActivityResultToResponse } from "../../../../../infraestructure/mappers/map-activity-result";
import { loadAuthorNames } from "../../../../services/author-names";

interface IListTaskNotebookSessionByStudentRequest {
  studentId: string;
  educatorId: Uuid;
}

export class ListTaskNotebookSessionByStudentIdUseCase {
  constructor(
    private taskNotebookSessionRepository: TaskNotebookSessionRepository,
    private studentAccess: StudentAccessService,
    private sessionEvolutionRepository: SessionEvolutionRepository,
    private activityResultRepository: ActivityResultRepository,
    private educatorRepository: EducatorRepository
  ) {}

  async execute(props: IListTaskNotebookSessionByStudentRequest) {
    // RS-08: só quem acessa o aluno (dono ou compartilhado) lista.
    if (!Uuid.isValid(props.studentId)) return failure("STUDENT_NOT_FOUND" as const);
    const access = await this.studentAccess.assertStudentAccess(
      new Uuid(props.studentId),
      props.educatorId
    );
    if (!access.ok) return access;

    const sessions = await this.taskNotebookSessionRepository.listByStudentId(
      access.value.id
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

    // EQ-12: quem conduziu, quando não é quem lê.
    const authorNames = await loadAuthorNames(
      this.educatorRepository,
      sessions.map((session) => session.educatorId),
      props.educatorId
    );

    return success(
      sessions.map((session) => ({
        ...mapTaskNotebookSessionToResponse(session),
        evolutionId: evolutionIds.get(session.id.value),
        activityResults: resultsBySession.get(session.id.value) ?? [],
        authorName: authorNames.get(session.educatorId.value),
      }))
    );
  }
}
