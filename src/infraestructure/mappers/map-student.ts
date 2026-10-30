import { Student } from "../../domain/entities/student";

export const mapStudentToResponse = (student: Student) => {
  return {
    id: student.id.value,
    name: student.name,
    age: student.age,
    gender: student.gender,
    zipcode: student.zipcode,
    road: student.road,
    housenumber: student.housenumber,
    phonenumber: student.phonenumber,
    learningTopics: student.learningTopics,
    createdAt: student.createdAt,
    educatorId: student.educatorId.value,
    photoUrl: student.photoUrl ?? null,
    documents: student.documents,
    guardianName: student.guardianName ?? null,
    guardianPhone: student.guardianPhone ?? null,
    guardianRelationship: student.guardianRelationship ?? null,
    educators: student.educators.map((educator) => ({
      id: educator.id.value,
      name: educator.name,
      profession: educator.profession ?? null,
    })),
  };
};
