import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { FileStorage } from "../../../../services/file-storage";
import { Gender } from "../../../../../domain/entities/student";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { mapStudentToResponse } from "../../../../../infraestructure/mappers/map-student";

interface UpdateStudentUseCaseRequest {
  id: string;
  educatorEmail: string;
  name?: string;
  age?: number;
  gender?: Gender;
  zipcode?: string;
  road?: string;
  housenumber?: string;
  phonenumber?: string;
  learningTopics?: string[];
  photo?: Express.Multer.File;
  guardianName?: string;
  guardianPhone?: string;
  guardianRelationship?: string;
}

export class UpdateStudentUseCase {
  constructor(
    private studentRepository: StudentRepository,
    private fileStorage: FileStorage,
    private educatorRepository: EducatorRepository
  ) {}

  async execute(props: UpdateStudentUseCaseRequest) {
    const student = await this.studentRepository.getById(new Uuid(props.id));
    if (!student) {
      return failure("STUDENT_NOT_FOUND");
    }

    const educator = await this.educatorRepository.getByEmail(
      props.educatorEmail
    );
    if (!educator) {
      return failure("EDUCATOR_NOT_FOUND");
    }

    if (student.educatorId.value !== educator.id.value) {
      return failure("STUDENT_NOT_ASSIGNED_TO_CURRENT_EDUCATOR");
    }

    if (props.photo) {
      const photoSaveResult = await this.fileStorage.saveFile({
        taskId: student.id.value,
        file: props.photo,
      });
      student.updatePhoto(photoSaveResult.url);
    }
    student.update(props);
    const result = await this.studentRepository.save(student);
    return success(mapStudentToResponse(result));
  }
}
