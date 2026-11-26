import { success, Uuid } from "@wave-telecom/framework/core";
import { AppointmentStatus } from "../../../../../domain/entities/appointment";
import {
  Notification,
  NOTIFICATION_RETENTION_DAYS,
} from "../../../../../domain/entities/notification";
import { Student } from "../../../../../domain/entities/student";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { NotificationRepository } from "../../../../../domain/repositories/notification-repository";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { ScaleApplicationRepository } from "../../../../../domain/repositories/scale-application-repository";
import { SessionEvolutionRepository } from "../../../../../domain/repositories/session-evolution-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { StudentShareRepository } from "../../../../../domain/repositories/student-share-repository";
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import {
  addDays,
  endOfDayInSaoPaulo,
  startOfDayInSaoPaulo,
  todayInSaoPaulo,
} from "../../../../../domain/utils/date-only";
import {
  EVOLUTION_PENDING_WINDOW_DAYS,
  PLAN_REVIEW_DAYS_AHEAD,
} from "../../../../../domain/services/patient-overview";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// EVOLUTION_PENDING: finalizada há mais de 24 h e menos de 30 dias. A janela
// e a antecedência da revisão são as mesmas do overview do paciente (PA-07).
const EVOLUTION_PENDING_AFTER_MS = 24 * HOUR_MS;
const SCALE_DRAFT_STALE_DAYS = 7;

// Cron diário (NT-01). Uma consulta em lote por kind, para todos os
// educadores. O dedupeKey único impede duplicatas (NT-02): APPOINTMENTS_TODAY
// sai uma vez por dia; cada pendência sai uma vez só, mesmo que continue
// aberta nos dias seguintes (PP-07). Se a retenção apagar a notificação e a
// pendência ainda existir, ela volta uma vez (aceito).
export class GenerateDailyNotificationsUseCase {
  constructor(
    private appointmentRepository: AppointmentRepository,
    private sessionRepository: TaskNotebookSessionRepository,
    private evolutionRepository: SessionEvolutionRepository,
    private planRepository: PlanRepository,
    private scaleApplicationRepository: ScaleApplicationRepository,
    private studentRepository: StudentRepository,
    private notificationRepository: NotificationRepository,
    private shareRepository: StudentShareRepository
  ) {}

  async execute() {
    const now = new Date();
    const today = todayInSaoPaulo(now);

    // Retenção (NT-04).
    const deleted = await this.notificationRepository.deleteCreatedBefore(
      new Date(now.getTime() - NOTIFICATION_RETENTION_DAYS * DAY_MS)
    );

    const appointments = await this.appointmentRepository.search({
      status: AppointmentStatus.PENDING,
      scheduledAfter: startOfDayInSaoPaulo(today),
      scheduledBefore: endOfDayInSaoPaulo(today),
    });

    const finishedSessions = await this.sessionRepository.listFinishedBetween({
      from: new Date(now.getTime() - EVOLUTION_PENDING_WINDOW_DAYS * DAY_MS),
      to: new Date(now.getTime() - EVOLUTION_PENDING_AFTER_MS),
    });
    const evolutionIds = finishedSessions.length
      ? await this.evolutionRepository.findIdsBySessionIds(
          finishedSessions.map((session) => session.id)
        )
      : new Map<string, string>();
    const pendingSessions = finishedSessions.filter(
      (session) => !evolutionIds.has(session.id.value)
    );

    const plans = await this.planRepository.listActiveWithReviewDueBy(
      addDays(today, PLAN_REVIEW_DAYS_AHEAD)
    );

    const staleDrafts = await this.scaleApplicationRepository.listDraftsUpdatedBefore(
      new Date(now.getTime() - SCALE_DRAFT_STALE_DAYS * DAY_MS)
    );

    const studentIds = new Set([
      ...appointments.map((a) => a.studentId.value),
      ...pendingSessions.map((s) => s.studentId.value),
      ...plans.map((p) => p.studentId.value),
      ...staleDrafts.map((a) => a.studentId.value),
    ]);
    const students = studentIds.size
      ? await this.studentRepository.getByIds([...studentIds].map((id) => new Uuid(id)))
      : [];
    // PA-03: aluno arquivado não gera notificação.
    const studentById = new Map<string, Student>(
      students
        .filter((student) => !student.isArchived)
        .map((student) => [student.id.value, student])
    );

    // EQ-14: quem não é dono só recebe enquanto o aluno está compartilhado com
    // ele. Os compartilhamentos dos alunos envolvidos, numa consulta só.
    const shares = studentIds.size
      ? await this.shareRepository.listByStudentIds([...studentIds].map((id) => new Uuid(id)))
      : [];
    const sharedPairs = new Set(
      shares.map((share) => `${share.studentId.value}:${share.educatorId.value}`)
    );
    const hasAccess = (student: Student, educatorId: Uuid) =>
      student.educatorId.value === educatorId.value ||
      sharedPairs.has(`${student.id.value}:${educatorId.value}`);

    const notifications: Notification[] = [];

    // Só conta atendimento de aluno ativo (PA-03) que o educador ainda acessa
    // (EQ-11): o arquivado não está em studentById.
    const countByEducator = new Map<string, number>();
    for (const appointment of appointments) {
      const student = studentById.get(appointment.studentId.value);
      if (!student || !hasAccess(student, appointment.educatorId)) continue;
      const key = appointment.educatorId.value;
      countByEducator.set(key, (countByEducator.get(key) ?? 0) + 1);
    }
    for (const [educatorId, count] of countByEducator) {
      notifications.push(
        Notification.appointmentsToday({
          educatorId: new Uuid(educatorId),
          date: today,
          count,
          now,
        })
      );
    }

    // EQ-14: a evolução pendente é de quem conduziu a sessão, enquanto ele
    // ainda acessa o aluno (mesma regra da lista de pendentes).
    for (const session of pendingSessions) {
      const student = studentById.get(session.studentId.value);
      if (!student || !hasAccess(student, session.educatorId)) continue;
      notifications.push(
        Notification.evolutionPending({
          educatorId: session.educatorId,
          date: today,
          studentId: student.id,
          firstName: student.firstName,
          sessionId: session.id,
          now,
        })
      );
    }

    // Revisão de plano vai para o dono atual do aluno (EQ-14).
    for (const plan of plans) {
      const student = studentById.get(plan.studentId.value);
      if (!student) continue;
      notifications.push(
        Notification.planReviewDue({
          educatorId: student.educatorId,
          date: today,
          studentId: student.id,
          firstName: student.firstName,
          planId: plan.id,
          nextReviewDate: plan.nextReviewDate!,
          now,
        })
      );
    }

    // Rascunho de escala vai para quem começou a aplicação, enquanto ele ainda
    // acessa o aluno (EQ-14).
    for (const application of staleDrafts) {
      const student = studentById.get(application.studentId.value);
      if (!student || !hasAccess(student, application.educatorId)) continue;
      notifications.push(
        Notification.scaleDraftStale({
          educatorId: application.educatorId,
          date: today,
          studentId: student.id,
          firstName: student.firstName,
          applicationId: application.id,
          templateName: application.templateName,
          days: Math.floor((now.getTime() - application.updatedAt.getTime()) / DAY_MS),
          updatedAt: application.updatedAt,
          now,
        })
      );
    }

    const created = await this.notificationRepository.createMany(notifications);

    return success({ created, deleted });
  }
}
