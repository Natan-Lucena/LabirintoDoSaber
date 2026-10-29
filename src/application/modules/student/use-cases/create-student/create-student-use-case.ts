import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { Gender, Student } from "../../../../../domain/entities/student";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { FileStorage } from "../../../../services/file-storage";
import { mapStudentToResponse } from "../../../../../infraestructure/mappers/map-student";

export interface CreateStudentUseCaseRequest {
  name: string;
  age: number;
  gender: Gender;
  zipcode: string;
  road: string;
  housenumber: string;
  phonenumber: string;
  photo?: Express.Multer.File;
  learningTopics: string[];
  educatorEmail: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianRelationship?: string;
}

export class CreateStudentUseCase {
  constructor(
    private studentRepository: StudentRepository,
    private educatorRepository: EducatorRepository,
    private fileStorage: FileStorage
  ) {}

  async execute(request: CreateStudentUseCaseRequest) {
    const educatorExists = await this.educatorRepository.getByEmail(
      request.educatorEmail
    );

    if (!educatorExists) {
      return failure("EDUCATOR_NOT_FOUND");
    }

    let photoUrl: string | undefined;
    const id = Uuid.random();
    if (request.photo) {
      const photoSaveResult = await this.fileStorage.saveFile({
        taskId: id.value,
        file: request.photo,
      });
      photoUrl = photoSaveResult.url;
    }

    const student = Student.create({
      id: id,
      name: request.name,
      age: request.age,
      gender: request.gender,
      zipcode: request.zipcode,
      road: request.road,
      housenumber: request.housenumber,
      phonenumber: request.phonenumber,
      learningTopics: request.learningTopics,
      educators: [educatorExists],
      educatorId: educatorExists.id,
      photoUrl: photoUrl,
      guardianName: request.guardianName,
      guardianPhone: request.guardianPhone,
      guardianRelationship: request.guardianRelationship,
    });

    await this.studentRepository.save(student);

    return success(mapStudentToResponse(student));
  }
}
