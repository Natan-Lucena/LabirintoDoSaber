import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { AppointmentRepository } from "../../../../domain/repositories/appointment-repository";
import { StudentAccessService } from "../../../../domain/services/student-access-service";

// Atendimento que o educador pode ler e editar: o de um aluno que ele acessa,
// dono ou compartilhado (EQ-11), inclusive o que ele mesmo criou. Quem perdeu
// o acesso ao aluno não lê, edita nem exclui. Sem acesso, NOT_FOUND, para não
// revelar que o atendimento existe. Devolve também o aluno, já carregado na
// checagem de acesso.
export async function loadAccessibleAppointment(
  appointmentRepository: AppointmentRepository,
  studentAccess: StudentAccessService,
  id: Uuid,
  educatorId: Uuid
) {
  const appointment = await appointmentRepository.findById(id);
  if (!appointment) return failure("NOT_FOUND");

  const access = await studentAccess.assertStudentAccess(appointment.studentId, educatorId);
  if (!access.ok) return failure("NOT_FOUND");

  return success({ appointment, student: access.value });
}
