import { AppointmentSchedulerService } from "../../domain/services/appointment-scheduler-service";
import { AppointmentRepository } from "../../domain/repositories/appointment-repository";
import { Appointment, AppointmentStatus } from "../../domain/entities/appointment";

const CHAIN_KEY = "qstashMessageId";

export class QStashAppointmentSchedulerImpl implements AppointmentSchedulerService {
  constructor(private appointmentRepo: AppointmentRepository) {}

  async ensureScheduled(appointment: Appointment): Promise<void> {
    const [chainLeader] = await this.appointmentRepo.search({
      status: AppointmentStatus.PENDING,
      scheduledAfter: new Date(),
      hasScheduledJob: true,
      limit: 1,
    });

    if (chainLeader) {
      if (chainLeader.scheduledAt <= appointment.scheduledAt) {
        return;
      }
      const messageId = chainLeader.metadata[CHAIN_KEY] as string;
      await this._deleteQStashMessage(messageId);
      await this.appointmentRepo.save(chainLeader.withMetadata(CHAIN_KEY, null));
    }

    await this._publishAndSave(appointment);
  }

  async cancel(appointment: Appointment): Promise<void> {
    const messageId = appointment.metadata[CHAIN_KEY];
    if (typeof messageId === "string") {
      await this._deleteQStashMessage(messageId);
      await this.appointmentRepo.save(appointment.withMetadata(CHAIN_KEY, null));
    }
    await this.scheduleNext();
  }

  async scheduleNext(): Promise<void> {
    const [next] = await this.appointmentRepo.search({
      status: AppointmentStatus.PENDING,
      scheduledAfter: new Date(),
      notified: false,
      hasScheduledJob: false,
      limit: 1,
    });

    if (next) {
      await this._publishAndSave(next);
    }
  }

  private async _publishAndSave(appointment: Appointment): Promise<void> {
    const qstashUrl = process.env.QSTASH_URL ?? "";
    const apiUrl = process.env.API_URL ?? "";
    const qstashToken = process.env.QSTASH_TOKEN ?? "";
    const internalJobApiKey = process.env.INTERNAL_JOB_API_KEY ?? "";

    const response = await fetch(
      `${qstashUrl}/v2/publish/${apiUrl}/api/queue/appointments/run`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${qstashToken}`,
          "Content-Type": "application/json",
          "Upstash-Not-Before": String(Math.floor(appointment.scheduledAt.getTime() / 1000)),
          "Upstash-Forward-X-Job-Api-Key": internalJobApiKey,
          "Upstash-Retries": "5",
        },
        body: JSON.stringify({ appointmentId: appointment.id.value }),
      }
    );

    const data = await response.json() as { messageId: string };
    await this.appointmentRepo.save(
      appointment.withMetadata(CHAIN_KEY, data.messageId)
    );
  }

  private async _deleteQStashMessage(messageId: string): Promise<void> {
    const qstashUrl = process.env.QSTASH_URL ?? "";
    const qstashToken = process.env.QSTASH_TOKEN ?? "";

    await fetch(`${qstashUrl}/v2/messages/${messageId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${qstashToken}`,
      },
    });
  }
}
