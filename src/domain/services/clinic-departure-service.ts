import { Uuid } from "@wave-telecom/framework/core";

// EQ-09: quem sai da clínica (ou é removido) leva os pacientes dos quais é
// dono; os compartilhamentos com ele e dele dentro da clínica são desfeitos.
// Chamado antes de apagar o vínculo do membro.
export interface ClinicDepartureService {
  undoSharesOf(clinicId: Uuid, educatorId: Uuid): Promise<void>;
}
