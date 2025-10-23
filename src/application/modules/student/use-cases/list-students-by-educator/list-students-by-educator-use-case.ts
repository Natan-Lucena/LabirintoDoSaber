import { Uuid } from "@wave-telecom/framework/core";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";

interface ListStudentsByEducatorRequest {
  educatorId: Uuid;
}

export class ListStudentsByEducatorUseCase {
  constructor(private studentRepository: StudentRepository) {}

  async execute(request: ListStudentsByEducatorRequest) {
    return this.studentRepository.search({ educatorId: request.educatorId });
  }
}
