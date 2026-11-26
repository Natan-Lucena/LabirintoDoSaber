import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { AppointmentStatus } from "../../../../../domain/entities/appointment";
import { StudentStatus } from "../../../../../domain/entities/student";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { AppointmentSchedulerService } from "../../../../../domain/services/appointment-scheduler-service";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { mapStudentListItem } from "../student-list-item";
import { parseStudentId } from "../student-share-list";

export interface ChangeStudentStatusUseCaseRequest {
  educatorId: Uuid;
  studentId: string;
  status: StudentStatus;
  cancelFutureAppointments?: boolean;
}

// Arquivar e reativar o paciente: só o dono (PA-02, EQ-11).
export class ChangeStudentStatusUseCase {
  constructor(
    private studentAccess: StudentAccessService,
    private studentRepository: StudentRepository,
    private appointmentRepository: AppointmentRepository,
    private schedulerService: AppointmentSchedulerService
  ) {}

  async execute(request: ChangeStudentStatusUseCaseRequest) {
    const studentId = parseStudentId(request.studentId);
    if (!studentId) return failure("STUDENT_NOT_FOUND");

    const access = await this.studentAccess.assertStudentAccess(studentId, request.educatorId, {
      mode: "owner",
    });
    if (!access.ok) return access;
    const student = access.value;

    // PA-05: reativar não recria o que foi cancelado ao arquivar.
    if (request.status === "ACTIVE") {
      if (student.isArchived) {
        student.reactivate();
        await this.studentRepository.save(student);
      }
      return success(mapStudentListItem(student, "OWNER"));
    }

    if (student.isArchived) return success(mapStudentListItem(student, "OWNER"));

    const now = new Date();

    // Futuros PENDING do aluno, de qualquer educador (o compartilhado também
    // agenda para ele).
    const future = await this.appointmentRepository.search({
      studentId: student.id,
      status: AppointmentStatus.PENDING,
      scheduledAfter: now,
    });

    if (future.length > 0 && !request.cancelFutureAppointments) {
      return failure({ code: "HAS_FUTURE_APPOINTMENTS" as const, count: future.length });
    }

    // Mesmo fluxo do cancelamento de um atendimento: salvar como CANCELLED
    // antes de mexer na cadeia do QStash, senão o scheduleNext chamado por
    // cancel reescolheria um destes atendimentos como próximo líder. Todos
    // são salvos antes de qualquer cancel pelo mesmo motivo.
    const cancelled = future.map((appointment) => appointment.cancel());
    for (const appointment of cancelled) {
      await this.appointmentRepository.save(appointment);
    }
    for (const appointment of cancelled) {
      await this.schedulerService.cancel(appointment);
    }

    student.archive(now);
    await this.studentRepository.save(student);

    return success(mapStudentListItem(student, "OWNER"));
  }
}
