// Fábricas para os specs de compartilhamento e da lista de alunos. Reusa os
// repositórios em memória da clínica e dos compartilhamentos.
import { Uuid } from "@wave-telecom/framework/core";
import { Gender, Student } from "../../../../domain/entities/student";
import { Educator } from "../../../../domain/entities/educator";
import { ClinicMember } from "../../../../domain/entities/clinic-member";
import {
  makeShareRepository,
  makeStudentRepositoryFake,
} from "../../../../domain/tests/fakes/student-share-fakes";
import { StudentAccessService } from "../../../../domain/services/student-access-service";
import { makeEducator, setupClinic } from "../../clinic/use-cases/test-fixtures";

export const makeStudent = (educatorId: Uuid, name = "Ana") =>
  Student.create({
    name,
    age: 8,
    gender: Gender.Female,
    zipcode: "00000000",
    road: "Rua",
    housenumber: "1",
    phonenumber: "11999999999",
    learningTopics: [],
    educators: [],
    educatorId,
  });

// Clínica com ADMIN (Beatriz), dona do paciente Paula (PROFESSIONAL), a
// colega Carla (PROFESSIONAL) e Fora, que não é da clínica.
export const setupSharing = () => {
  const owner = makeEducator("Paula");
  const colleague = makeEducator("Carla");
  const outsider = makeEducator("Fora");
  const ctx = setupClinic([
    { educator: owner, role: "PROFESSIONAL" },
    { educator: colleague, role: "PROFESSIONAL" },
  ]);
  ctx.educatorRepository.store.set(outsider.id.value, outsider);

  const student = makeStudent(owner.id);
  const studentRepository = makeStudentRepositoryFake([student]);
  const shareRepository = makeShareRepository();
  const studentAccess = new StudentAccessService(studentRepository, shareRepository);

  return {
    ...ctx,
    owner,
    colleague,
    outsider,
    student,
    studentRepository,
    shareRepository,
    studentAccess,
  };
};

export const joinClinic = (
  memberRepository: ReturnType<typeof setupClinic>["memberRepository"],
  clinicId: Uuid,
  educator: Educator
) =>
  memberRepository.store.set(
    educator.id.value,
    ClinicMember.create({ clinicId, educatorId: educator.id, role: "PROFESSIONAL" })
  );
