import { Appointment } from "../../domain/entities/appointment";

export function mapAppointmentToResponse(appointment: Appointment) {
  return {
    id: appointment.id.value,
    educatorId: appointment.educatorId.value,
    studentId: appointment.studentId.value,
    scheduledAt: appointment.scheduledAt,
    observation: appointment.observation,
    status: appointment.status,
    notifiedAt: appointment.notifiedAt,
    createdAt: appointment.createdAt,
  };
}
