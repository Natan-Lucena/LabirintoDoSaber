import { success, Uuid } from "@wave-telecom/framework/core";
import { AppointmentStatus } from "../../../../../domain/entities/appointment";
import { SeriesResult } from "../../../../../domain/entities/appointment-series";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { AppointmentSeriesRepository } from "../../../../../domain/repositories/appointment-series-repository";
import { AppointmentSchedulerService } from "../../../../../domain/services/appointment-scheduler-service";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { loadAccessibleSeries, loadOccurrencesFrom } from "../series-access";

export interface CancelAppointmentSeriesUseCaseRequest {
  educatorId: Uuid;
  seriesId: string;
  fromAppointmentId: string;
}

// RC-06: cancela a ocorrência indicada e as seguintes PENDING que ainda vão
// acontecer e encerra a série. Passadas, concluídas e já canceladas ficam
// como estão, como no arquivamento; a indicada pode já ter passado.
export class CancelAppointmentSeriesUseCase {
  constructor(
    private appointmentRepository: AppointmentRepository,
    private seriesRepository: AppointmentSeriesRepository,
    private schedulerService: AppointmentSchedulerService,
    private studentAccess: StudentAccessService
  ) {}

  async execute(request: CancelAppointmentSeriesUseCaseRequest) {
    const loaded = await loadAccessibleSeries(
      this.seriesRepository,
      this.studentAccess,
      request.seriesId,
      request.educatorId
    );
    if (!loaded.ok) return loaded;

    const occurrences = await loadOccurrencesFrom(
      this.appointmentRepository,
      loaded.value.id,
      request.fromAppointmentId
    );
    if (!occurrences.ok) return occurrences;

    const now = new Date();
    const cancelled = occurrences.value
      .filter(
        (appointment) =>
          appointment.status === AppointmentStatus.PENDING && appointment.scheduledAt > now
      )
      .map((appointment) => appointment.cancel());

    // Mesmo fluxo do arquivamento: todas gravadas como CANCELLED antes de
    // mexer na cadeia, senão o scheduleNext chamado por cancel reescolheria
    // uma delas como próximo líder.
    for (const appointment of cancelled) {
      await this.appointmentRepository.save(appointment);
    }

    const series = loaded.value.end(now);
    await this.seriesRepository.save(series);

    for (const appointment of cancelled) {
      await this.schedulerService.cancel(appointment);
    }

    return success<SeriesResult>({ series, created: cancelled, skipped: [] });
  }
}
