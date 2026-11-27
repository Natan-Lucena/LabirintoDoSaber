import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { Appointment } from "../../../../domain/entities/appointment";
import { AppointmentRepository } from "../../../../domain/repositories/appointment-repository";
import { AppointmentSeriesRepository } from "../../../../domain/repositories/appointment-series-repository";
import { StudentAccessService } from "../../../../domain/services/student-access-service";

// Série que o educador pode ler e editar: a de um aluno que ele acessa, dono
// ou compartilhado (EQ-11). Id inválido ou inexistente: SERIES_NOT_FOUND.
export async function loadAccessibleSeries(
  seriesRepository: AppointmentSeriesRepository,
  studentAccess: StudentAccessService,
  seriesId: string,
  educatorId: Uuid
) {
  if (!Uuid.isValid(seriesId)) return failure("SERIES_NOT_FOUND");

  const series = await seriesRepository.findById(new Uuid(seriesId));
  if (!series) return failure("SERIES_NOT_FOUND");

  const access = await studentAccess.assertStudentAccess(series.studentId, educatorId);
  // Aluno excluído também fecha o acesso à série.
  if (!access.ok) return failure("UNAUTHORIZED");

  return success(series);
}

// Ocorrências da série em ordem, a partir da indicada (inclusive). A indicada
// precisa ser da série: APPOINTMENT_NOT_IN_SERIES.
export async function loadOccurrencesFrom(
  appointmentRepository: AppointmentRepository,
  seriesId: Uuid,
  fromAppointmentId: string
) {
  const occurrences = await appointmentRepository.search({ seriesId });
  const index = occurrences.findIndex((appointment) => appointment.id.value === fromAppointmentId);
  if (index < 0) return failure("APPOINTMENT_NOT_IN_SERIES");

  return success<Appointment[]>(occurrences.slice(index));
}
