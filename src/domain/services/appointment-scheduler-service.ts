import { Appointment } from "../entities/appointment";

export interface AppointmentSchedulerService {
  ensureScheduled(appointment: Appointment): Promise<void>;
  cancel(appointment: Appointment): Promise<void>;
  scheduleNext(): Promise<void>;
}
