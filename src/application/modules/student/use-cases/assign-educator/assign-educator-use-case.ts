import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { ClinicMemberRepository } from "../../../../../domain/repositories/clinic-member-repository";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { StudentShareRepository } from "../../../../../domain/repositories/student-share-repository";
import { StudentAccessService } from "../../../../../domain/services/student-access-service";
import { mapStudentToResponse } from "../../../../../infraestructure/mappers/map-student";

export interface AssignEducatorUseCaseRequest {
  educatorId: Uuid;
  studentId: Uuid;
  newEducatorEmail: string;
}

export class AssignEducatorUseCase {
  constructor(
    private studentAccess: StudentAccessService,
    private studentRepository: StudentRepository,
    private educatorRepository: EducatorRepository,
    private memberRepository: ClinicMemberRepository,
    private shareRepository: StudentShareRepository
  ) {}

  async execute(props: AssignEducatorUseCaseRequest) {
    // Só o dono transfere; o compartilhado não (EQ-11).
    const access = await this.studentAccess.assertStudentAccess(
      props.studentId,
      props.educatorId,
      { mode: "owner" }
    );
    if (!access.ok) {
      return failure(
        access.error === "STUDENT_NOT_FOUND"
          ? "STUDENT_NOT_FOUND"
          : "STUDENT_NOT_ASSIGNED_TO_CURRENT_EDUCATOR"
      );
    }
    const student = access.value;

    const newEducator = await this.educatorRepository.getByEmail(
      props.newEducatorEmail
    );
    if (!newEducator) {
      return failure("NEW_EDUCATOR_NOT_FOUND");
    }

    // EQ-15: dono numa clínica só passa o paciente para um colega dela.
    const ownerMember = await this.memberRepository.findByEducatorId(props.educatorId);
    if (ownerMember) {
      const newMember = await this.memberRepository.findByEducatorId(newEducator.id);
      if (!newMember || newMember.clinicId.value !== ownerMember.clinicId.value) {
        return failure("NOT_IN_SAME_CLINIC");
      }
    }

    // Transferir para o próprio dono não muda nada.
    if (newEducator.id.value === student.educatorId.value) {
      return success(mapStudentToResponse(student));
    }

    // O novo educador vira o dono. Os compartilhamentos do aluno são
    // desfeitos: o novo dono recompartilha se quiser. Em sequência, sem
    // transação: primeiro o aluno, depois os compartilhamentos.
    student.assignEducator(newEducator);
    student.transferTo(newEducator.id);

    await this.studentRepository.save(student);
    await this.shareRepository.deleteByStudentId(student.id);
    return success(mapStudentToResponse(student));
  }
}
