import { Uuid } from "@wave-telecom/framework/core";
import { AppointmentSeries } from "../entities/appointment-series";

export interface AppointmentSeriesRepository {
  save(series: AppointmentSeries): Promise<void>;
  findById(id: Uuid): Promise<AppointmentSeries | null>;
}
