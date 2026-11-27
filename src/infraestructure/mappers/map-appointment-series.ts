import {
  AppointmentSeries,
  SeriesResult,
} from "../../domain/entities/appointment-series";
import { mapAppointmentToResponse } from "./map-appointment";

export function mapAppointmentSeriesToResponse(series: AppointmentSeries) {
  return {
    id: series.id.value,
    studentId: series.studentId.value,
    educatorId: series.educatorId.value,
    frequency: series.frequency,
    firstScheduledAt: series.firstScheduledAt,
    occurrences: series.occurrences,
    type: series.type,
    durationMinutes: series.durationMinutes,
    observation: series.observation,
    endedAt: series.endedAt,
    createdAt: series.createdAt,
  };
}

export function mapSeriesResultToResponse(result: SeriesResult) {
  return {
    series: mapAppointmentSeriesToResponse(result.series),
    created: result.created.map(mapAppointmentToResponse),
    skipped: result.skipped,
  };
}
