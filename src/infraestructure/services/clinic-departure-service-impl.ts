import { Uuid } from "@wave-telecom/framework/core";
import { ClinicDepartureService } from "../../domain/services/clinic-departure-service";
import { StudentRepository } from "../../domain/repositories/student-repository";
import { StudentShareRepository } from "../../domain/repositories/student-share-repository";

// EQ-09. Quem sai leva os pacientes dos quais é dono (o dono continua em
// Student.educatorId, nada muda nele). Os compartilhamentos com ele e os dos
// pacientes dele são desfeitos. Um educador está em no máximo uma clínica e
// só compartilha com membros dela, então todos esses compartilhamentos são
// da clínica que ele deixa.
export class ClinicDepartureServiceImpl implements ClinicDepartureService {
  constructor(
    private studentRepository: StudentRepository,
    private shareRepository: StudentShareRepository
  ) {}

  async undoSharesOf(_clinicId: Uuid, educatorId: Uuid): Promise<void> {
    const owned = await this.studentRepository.search({ educatorId });
    await this.shareRepository.deleteForEducatorDeparture(
      educatorId,
      owned.map((student) => student.id)
    );
  }
}
