import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { AppointmentSchedulerService } from "../../../../../domain/services/appointment-scheduler-service";
import { MailService } from "../../../../../domain/services/mail-service";
import { AppointmentStatus } from "../../../../../domain/entities/appointment";

export class NotifyAppointmentsUseCase {
  constructor(
    private appointmentRepository: AppointmentRepository,
    private schedulerService: AppointmentSchedulerService,
    private mailService: MailService
  ) {}

  async execute(): Promise<void> {
    const scheduledBefore = new Date(Date.now() + 15 * 60 * 1000);

    const appointments = await this.appointmentRepository.search({
      status: AppointmentStatus.PENDING,
      scheduledBefore,
      notified: false,
    });

    for (const appointment of appointments) {
      try {
        await this.mailService.sendAppointmentReminder(appointment);
        const notified = appointment.markAsNotified(new Date());
        await this.appointmentRepository.save(notified);
      } catch {
        // continue silently on per-appointment errors
      }
    }

    await this.schedulerService.scheduleNext();
  }
}
