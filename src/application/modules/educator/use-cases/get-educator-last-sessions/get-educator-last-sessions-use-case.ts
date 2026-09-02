import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";

interface GetEducatorLastSessionsRequest {
  educatorEmail: string;
}

export class GetEducatorLastSessionsUseCase {
  constructor(
    private educatorRepository: EducatorRepository,
    private sessionRepository: TaskNotebookSessionRepository,
    private studentRepository: StudentRepository
  ) {}

  async execute(request: GetEducatorLastSessionsRequest) {
    const educatorExists = await this.educatorRepository.getByEmail(
      request.educatorEmail
    );

    if (!educatorExists) {
      return failure("EDUCATOR_NOT_FOUND");
    }

    const educatorLastSessions = await this.sessionRepository.listByEducatorId({
      educatorId: educatorExists.id,
      limit: 2,
    });
    if (educatorLastSessions.length === 0) {
      return failure("EDUCATOR_DOES_NOT_HAVE_SESSIONS");
    }

    const uniqueStudentIds = new Map<string, Uuid>();
    for (const session of educatorLastSessions) {
      uniqueStudentIds.set(session.studentId.value, session.studentId);
    }

    const students = await this.studentRepository.getByIds(
      Array.from(uniqueStudentIds.values())
    );
    const studentById = new Map(
      students.map((student) => [student.id.value, student])
    );

    const result = educatorLastSessions.map((session) => ({
      studentName: studentById.get(session.studentId.value)?.name,
      sessionName: session.name,
    }));

    return success(result);
  }
}
