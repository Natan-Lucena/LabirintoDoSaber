import { Uuid } from "@wave-telecom/framework/core";
import { ClinicDepartureService } from "../../domain/services/clinic-departure-service";

// EQ-09. Ainda não há compartilhamento de paciente, então não há o que
// desfazer: quem sai já leva os pacientes dos quais é dono (o dono continua
// em Student.educatorId). O compartilhamento vai implementar aqui a remoção
// dos compartilhamentos com o educador e dele dentro da clínica.
export class ClinicDepartureServiceImpl implements ClinicDepartureService {
  async undoSharesOf(_clinicId: Uuid, _educatorId: Uuid): Promise<void> {
    return;
  }
}
