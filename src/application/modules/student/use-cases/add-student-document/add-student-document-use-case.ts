import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { FileStorage } from "../../../../services/file-storage";
import { mapStudentToResponse } from "../../../../../infraestructure/mappers/map-student";

interface AddStudentDocumentUseCaseRequest {
  studentId: string;
  educatorEmail: string;
  file: Express.Multer.File;
}

export class AddStudentDocumentUseCase {
  constructor(
    private studentRepository: StudentRepository,
    private educatorRepository: EducatorRepository,
    private fileStorage: FileStorage
  ) {}

  async execute(request: AddStudentDocumentUseCaseRequest) {
    const student = await this.studentRepository.getById(
      new Uuid(request.studentId)
    );
    if (!student) {
      return failure("STUDENT_NOT_FOUND");
    }

    const educator = await this.educatorRepository.getByEmail(
      request.educatorEmail
    );
    if (!educator) {
      return failure("EDUCATOR_NOT_FOUND");
    }

    if (student.educatorId.value !== educator.id.value) {
      return failure("STUDENT_NOT_ASSIGNED_TO_CURRENT_EDUCATOR");
    }

    const { url } = await this.fileStorage.saveFile({
      taskId: student.id.value,
      file: request.file,
    });

    student.addDocument({
      id: Uuid.random().value,
      name: request.file.originalname,
      url,
      uploadedAt: new Date(),
    });

    const saved = await this.studentRepository.save(student);

    return success(mapStudentToResponse(saved));
  }
}
