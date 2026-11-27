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

// Conflitos de vários atendimentos do mesmo educador numa consulta só (série):
// id do atendimento → o PENDING com que ele colide. Os próprios atendimentos
// da lista não contam como conflito entre si nem com a versão gravada deles.
export async function findAppointmentConflicts(
  appointmentRepository: AppointmentRepository,
  appointments: Appointment[]
): Promise<Map<string, Appointment>> {
  const conflicts = new Map<string, Appointment>();
  if (appointments.length === 0) return conflicts;

  const times = appointments.map((appointment) => appointment.scheduledAt.getTime());
  const candidates = await appointmentRepository.search({
    educatorId: appointments[0].educatorId,
    status: AppointmentStatus.PENDING,
    scheduledAfter: new Date(Math.min(...times) - SEARCH_WINDOW_MS),
    scheduledBefore: new Date(Math.max(...times) + SEARCH_WINDOW_MS),
  });

  const ownIds = new Set(appointments.map((appointment) => appointment.id.value));
  const others = candidates.filter((candidate) => !ownIds.has(candidate.id.value));

  for (const appointment of appointments) {
    const conflict = others.find((candidate) => candidate.overlaps(appointment));
    if (conflict) conflicts.set(appointment.id.value, conflict);
  }

  return conflicts;
}
