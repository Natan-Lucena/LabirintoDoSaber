import { success, Uuid } from "@wave-telecom/framework/core";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { AppointmentSeriesRepository } from "../../../../../domain/repositories/appointment-series-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { loadAccessibleSeries } from "../series-access";

export interface GetAppointmentSeriesUseCaseRequest {
  educatorId: Uuid;
  seriesId: string;
}

export class GetAppointmentSeriesUseCase {
  constructor(
    private appointmentRepository: AppointmentRepository,
    private seriesRepository: AppointmentSeriesRepository,
    private studentAccess: StudentAccessService
  ) {}

  async execute(request: GetAppointmentSeriesUseCaseRequest) {
    const loaded = await loadAccessibleSeries(
      this.seriesRepository,
      this.studentAccess,
      request.seriesId,
      request.educatorId
    );
    if (!loaded.ok) return loaded;
    const series = loaded.value;

    // O repositório já devolve em ordem de data.
    const appointments = await this.appointmentRepository.search({ seriesId: series.id });

    return success({ series, appointments });
  }
}
