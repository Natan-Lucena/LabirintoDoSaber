import { failure, success } from "@wave-telecom/framework/core";
import { Gender, Student } from "../../../../../domain/entities/student";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";

export interface CreateStudentUseCaseRequest {
  name: string;
  age: number;
  gender: Gender;
  learningTopics: string[];
  educatorEmail: string;
}

export class CreateStudentUseCase {
  constructor(
    private studentRepository: StudentRepository,
    private educatorRepository: EducatorRepository
  ) {}

  async execute(request: CreateStudentUseCaseRequest) {
    const educatorExists = await this.educatorRepository.getByEmail(
      request.educatorEmail
    );

    if (!educatorExists) {
      return failure("EDUCATOR_NOT_FOUND");
    }

    const student = Student.create({
      name: request.name,
      age: request.age,
      gender: request.gender,
      learningTopics: request.learningTopics,
      educator: educatorExists,
    });

    await this.studentRepository.save(student);

    return success(student);
  }
}
