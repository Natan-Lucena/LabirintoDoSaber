import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { AppointmentRepository } from "../../../../domain/repositories/appointment-repository";
import { StudentAccessService } from "../../../../domain/services/student-access-service";

// Atendimento que o educador pode ler e editar: o dele (a agenda dele) ou o
// de um aluno que ele acessa, dono ou compartilhado (EQ-11). Sem acesso,
// NOT_FOUND, para não revelar que o atendimento existe.
export async function loadAccessibleAppointment(
  appointmentRepository: AppointmentRepository,
  studentAccess: StudentAccessService,
  id: Uuid,
  educatorId: Uuid
) {
  const appointment = await appointmentRepository.findById(id);
  if (!appointment) return failure("NOT_FOUND");

  if (appointment.educatorId.value === educatorId.value) return success(appointment);

  const access = await studentAccess.assertStudentAccess(appointment.studentId, educatorId);
  if (!access.ok) return failure("NOT_FOUND");

  return success(appointment);
}
