import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { AppointmentSchedulerService } from "../../../../../domain/services/appointment-scheduler-service";
import { AppointmentStatus } from "../../../../../domain/entities/appointment";

export class WatchdogAppointmentsUseCase {
  constructor(
    private appointmentRepository: AppointmentRepository,
    private schedulerService: AppointmentSchedulerService
  ) {}

  async execute(): Promise<void> {
    const [pendingAppointments, chainLeaders] = await Promise.all([
      this.appointmentRepository.search({
        status: AppointmentStatus.PENDING,
        scheduledAfter: new Date(),
        notified: false,
      }),
      this.appointmentRepository.search({
        status: AppointmentStatus.PENDING,
        scheduledAfter: new Date(),
        hasScheduledJob: true,
        limit: 1,
      }),
    ]);

    const hasPending = pendingAppointments.length > 0;
    const hasChainLeader = chainLeaders.length > 0;

    if (hasPending && !hasChainLeader) {
      await this.schedulerService.scheduleNext();
    }
  }
}
