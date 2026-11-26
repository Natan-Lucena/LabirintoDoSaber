import { Uuid } from "@wave-telecom/framework/core";
import { AppointmentStatus } from "../../../../../domain/entities/appointment";
import { PlanStatus } from "../../../../../domain/entities/plan";
import { ApplicationStatus } from "../../../../../domain/entities/scale-application";
import { AnamneseResponseRepository } from "../../../../../domain/repositories/anamnese-response-repository";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { ScaleApplicationRepository } from "../../../../../domain/repositories/scale-application-repository";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import {
  buildPatientOverview,
  EVOLUTION_PENDING_WINDOW_DAYS,
  PatientOverview,
} from "../../../../../domain/services/patient-overview";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { todayInSaoPaulo } from "../../../../../domain/utils/date-only";
import { matchesStatus, StudentStatusFilter } from "../student-list-item";

const DAY_MS = 24 * 60 * 60 * 1000;
// Rascunhos por aluno: no máximo um por escala (AV-03); folga para as escalas
// do catálogo.
const DRAFTS_PER_STUDENT = 20;

export interface GetStudentsOverviewUseCaseRequest {
  educatorId: Uuid;
  status: StudentStatusFilter;
}

// GET /student/overview: status, plano ativo, próximo atendimento e
// pendências dos alunos acessíveis (PA-06, PA-07), calculados na leitura. Uma
// consulta por tipo de dado para todos os alunos, sem N+1.
export class GetStudentsOverviewUseCase {
  constructor(
    private studentAccess: StudentAccessService,
    private appointmentRepository: AppointmentRepository,
    private sessionRepository: TaskNotebookSessionRepository,
    private evolutionRepository: SessionEvolutionRepository,
    private planRepository: PlanRepository,
    private scaleApplicationRepository: ScaleApplicationRepository,
    private anamneseResponseRepository: AnamneseResponseRepository
  ) {}

  async execute(request: GetStudentsOverviewUseCaseRequest): Promise<PatientOverview[]> {
    const students = (await this.studentAccess.listAccessibleStudents(request.educatorId))
      .map(({ student }) => student)
      .filter((student) => matchesStatus(student, request.status));
    if (students.length === 0) return [];

    const studentIds = students.map((student) => student.id);
    const now = new Date();

    const [plans, appointments, sessions, drafts, withAnamnesis] = await Promise.all([
      this.planRepository.search({ studentIds, status: PlanStatus.ACTIVE }),
      this.appointmentRepository.search({
        studentIds,
        status: AppointmentStatus.PENDING,
        scheduledAfter: now,
      }),
      this.sessionRepository.listFinishedBetween({
        from: new Date(now.getTime() - EVOLUTION_PENDING_WINDOW_DAYS * DAY_MS),
        to: now,
        studentIds,
      }),
      this.scaleApplicationRepository.search({
        studentIds,
        status: ApplicationStatus.DRAFT,
        limit: studentIds.length * DRAFTS_PER_STUDENT,
      }),
      this.anamneseResponseRepository.findStudentIdsWithResponses(studentIds),
    ]);

    const evolutionIds = sessions.length
      ? await this.evolutionRepository.findIdsBySessionIds(sessions.map((s) => s.id))
      : new Map<string, string>();
    const pendingSessions = sessions.filter((session) => !evolutionIds.has(session.id.value));

    const today = todayInSaoPaulo(now);
    const plansOf = groupByStudent(plans);
    const appointmentsOf = groupByStudent(appointments);
    const pendingSessionsOf = groupByStudent(pendingSessions);
    const draftsOf = groupByStudent(drafts);

    return students.map((student) =>
      buildPatientOverview({
        studentId: student.id,
        today,
        activePlans: plansOf(student.id),
        futureAppointments: appointmentsOf(student.id),
        pendingEvolutionSessionIds: pendingSessionsOf(student.id).map((s) => s.id),
        scaleDrafts: draftsOf(student.id),
        hasAnamnesis: withAnamnesis.has(student.id.value),
      })
    );
  }
}

function groupByStudent<T extends { studentId: Uuid }>(items: T[]) {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = item.studentId.value;
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return (studentId: Uuid) => groups.get(studentId.value) ?? [];
}
