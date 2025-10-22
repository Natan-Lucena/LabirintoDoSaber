import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";

export interface AssignEducatorUseCaseRequest {
  studentId: Uuid;
  currentEducatorEmail: string;
  newEducatorEmail: string;
}

export class AssignEducatorUseCase {
  constructor(
    private studentRepository: StudentRepository,
    private educatorRepository: EducatorRepository
  ) {}

  async execute(props: AssignEducatorUseCaseRequest) {
    const student = await this.studentRepository.getById(props.studentId);

    if (!student) {
      return failure("STUDENT_NOT_FOUND");
    }

    const isStudentAssignedToCurrentEducator = student.educators.some(
      (educator) => educator.email === props.currentEducatorEmail
    );

    if (!isStudentAssignedToCurrentEducator) {
      return failure("STUDENT_NOT_ASSIGNED_TO_CURRENT_EDUCATOR");
    }
    const newEducator = await this.educatorRepository.getByEmail(
      props.newEducatorEmail
    );
    if (!newEducator) {
      return failure("NEW_EDUCATOR_NOT_FOUND");
    }
    student.assignEducator(newEducator);

    await this.studentRepository.save(student);
    return success(student);
  }
}
