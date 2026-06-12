import { Appointment } from "../../domain/entities/appointment";

export interface MailService {
  sendMail(to: string, subject: string, body: string): Promise<void>;
  sendAppointmentReminder(appointment: Appointment, educatorEmail: string): Promise<void>;
}
