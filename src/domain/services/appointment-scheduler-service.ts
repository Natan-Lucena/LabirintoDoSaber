import { Appointment } from "../entities/appointment";

export interface AppointmentSchedulerService {
  ensureScheduled(appointment: Appointment): Promise<void>;
  cancel(appointment: Appointment): Promise<void>;
  // PENDING remarcado, já gravado com o horário novo: tira o lembrete do
  // horário antigo, se ele carregava a cadeia, e o recoloca na cadeia.
  reschedule(appointment: Appointment): Promise<void>;
  scheduleNext(): Promise<void>;
}
