import { success, Uuid } from "@wave-telecom/framework/core";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ListPendingEvolutionsUseCaseRequest {
  educatorId: Uuid;
  days: number;
}

export class ListPendingEvolutionsUseCase {
  constructor(
    private sessionRepository: TaskNotebookSessionRepository,
    private evolutionRepository: SessionEvolutionRepository,
    private studentRepository: StudentRepository
  ) {}

  async execute(request: ListPendingEvolutionsUseCaseRequest) {
    const sessions = await this.sessionRepository.listFinishedByEducatorSince({
      educatorId: request.educatorId,
      since: new Date(Date.now() - request.days * DAY_MS),
    });
    if (sessions.length === 0) return success([]);

    const evolutionIds = await this.evolutionRepository.findIdsBySessionIds(
      sessions.map((session) => session.id)
    );

    const studentIds = [...new Set(sessions.map((s) => s.studentId.value))];
    const students = await this.studentRepository.getByIds(
      studentIds.map((id) => new Uuid(id))
    );
    const ownedStudents = new Map(
      students
        .filter((student) => student.educatorId.value === request.educatorId.value)
        .map((student) => [student.id.value, student])
    );

    const pending = sessions
      .filter(
        (session) =>
          !evolutionIds.has(session.id.value) &&
          ownedStudents.has(session.studentId.value)
      )
      .sort((a, b) => b.finishedAt!.getTime() - a.finishedAt!.getTime())
      .map((session) => ({
        sessionId: session.id.value,
        studentId: session.studentId.value,
        studentName: ownedStudents.get(session.studentId.value)!.name,
        sessionName: session.name,
        finishedAt: session.finishedAt!,
        appointmentId: session.appointmentId?.value,
      }));

    return success(pending);
  }
}
