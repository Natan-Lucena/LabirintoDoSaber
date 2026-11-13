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
import { TaskNotebookSessionRepository } from "../../../../../domain/repositories/task-notebook-session-repository";
import {
  addDays,
  endOfDayInSaoPaulo,
  startOfDayInSaoPaulo,
  todayInSaoPaulo,
} from "../../../../../domain/utils/date-only";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// EVOLUTION_PENDING: finalizada há mais de 24 h e menos de 30 dias.
const EVOLUTION_PENDING_AFTER_MS = 24 * HOUR_MS;
const EVOLUTION_PENDING_WINDOW_DAYS = 30;
const PLAN_REVIEW_DAYS_AHEAD = 2;
const SCALE_DRAFT_STALE_DAYS = 7;

// Cron diário (NT-01). Uma consulta em lote por kind, para todos os
// educadores; o dedupeKey único impede duplicatas no mesmo dia (NT-02).
export class GenerateDailyNotificationsUseCase {
  constructor(
    private appointmentRepository: AppointmentRepository,
    private sessionRepository: TaskNotebookSessionRepository,
    private evolutionRepository: SessionEvolutionRepository,
    private planRepository: PlanRepository,
    private scaleApplicationRepository: ScaleApplicationRepository,
    private studentRepository: StudentRepository,
    private notificationRepository: NotificationRepository
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
      ...pendingSessions.map((s) => s.studentId.value),
      ...plans.map((p) => p.studentId.value),
      ...staleDrafts.map((a) => a.studentId.value),
    ]);
    const students = studentIds.size
      ? await this.studentRepository.getByIds([...studentIds].map((id) => new Uuid(id)))
      : [];
    const studentById = new Map<string, Student>(
      students.map((student) => [student.id.value, student])
    );

    const notifications: Notification[] = [];

    const countByEducator = new Map<string, number>();
    for (const appointment of appointments) {
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

    // Mesma regra do pending: a sessão é do educador e o aluno ainda é dele.
    for (const session of pendingSessions) {
      const student = studentById.get(session.studentId.value);
      if (!student || student.educatorId.value !== session.educatorId.value) continue;
      notifications.push(
        Notification.evolutionPending({
          educatorId: student.educatorId,
          date: today,
          studentId: student.id,
          firstName: student.firstName,
          sessionId: session.id,
          now,
        })
      );
    }

    // Plano e escala vão para o dono atual do aluno.
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

    for (const application of staleDrafts) {
      const student = studentById.get(application.studentId.value);
      if (!student) continue;
      notifications.push(
        Notification.scaleDraftStale({
          educatorId: student.educatorId,
          date: today,
          studentId: student.id,
          firstName: student.firstName,
          applicationId: application.id,
          templateName: application.templateName,
          days: Math.floor((now.getTime() - application.updatedAt.getTime()) / DAY_MS),
          now,
        })
      );
    }

    const created = await this.notificationRepository.createMany(notifications);

    return success({ created, deleted });
  }
}
