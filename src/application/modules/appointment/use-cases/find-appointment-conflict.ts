import {
  Appointment,
  AppointmentStatus,
  MAX_APPOINTMENT_DURATION_MINUTES,
} from "../../../../domain/entities/appointment";
import { AppointmentRepository } from "../../../../domain/repositories/appointment-repository";

// Como nenhum atendimento dura mais que o máximo, nenhum fora desta janela pode se sobrepor.
const SEARCH_WINDOW_MS = MAX_APPOINTMENT_DURATION_MINUTES * 60_000;

export async function findAppointmentConflict(
  appointmentRepository: AppointmentRepository,
  appointment: Appointment
): Promise<Appointment | undefined> {
  const start = appointment.scheduledAt.getTime();

  const candidates = await appointmentRepository.search({
    educatorId: appointment.educatorId,
    status: AppointmentStatus.PENDING,
    scheduledAfter: new Date(start - SEARCH_WINDOW_MS),
    scheduledBefore: new Date(start + SEARCH_WINDOW_MS),
  });

  return candidates.find(
    (candidate) => candidate.id.value !== appointment.id.value && candidate.overlaps(appointment)
  );
}
