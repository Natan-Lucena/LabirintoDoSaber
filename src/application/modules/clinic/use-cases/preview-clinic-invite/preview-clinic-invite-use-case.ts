import crypto from "crypto";
import { failure, success } from "@wave-telecom/framework/core";
import { normalizeInviteCode } from "../../../../../domain/entities/clinic-invite";
import { ClinicRepository } from "../../../../../domain/repositories/clinic-repository";
import { ClinicInviteRepository } from "../../../../../domain/repositories/clinic-invite-repository";
import { RateLimitRepository } from "../../../../../domain/repositories/rate-limit-repository";

// EQ-07: 10 consultas por IP a cada 15 minutos.
export const INVITE_PREVIEW_LIMIT = 10;
export const INVITE_PREVIEW_WINDOW_MS = 15 * 60 * 1000;

export interface PreviewClinicInviteUseCaseRequest {
  code: string;
  ip: string;
  now?: Date;
}

// Janela fixa por IP. O IP vai para a chave só como hash.
function rateLimitKey(ip: string, windowIndex: number): string {
  const ipHash = crypto.createHash("sha256").update(ip).digest("hex");
  return `invite-preview:${ipHash}:${windowIndex}`;
}

// Prévia pública do convite, para a tela de cadastro com código.
export class PreviewClinicInviteUseCase {
  constructor(
    private inviteRepository: ClinicInviteRepository,
    private clinicRepository: ClinicRepository,
    private rateLimitRepository: RateLimitRepository
  ) {}

  async execute(request: PreviewClinicInviteUseCaseRequest) {
    const now = request.now ?? new Date();

    const windowIndex = Math.floor(now.getTime() / INVITE_PREVIEW_WINDOW_MS);
    const allowed = await this.rateLimitRepository.tryConsume(
      rateLimitKey(request.ip, windowIndex),
      INVITE_PREVIEW_LIMIT,
      new Date((windowIndex + 1) * INVITE_PREVIEW_WINDOW_MS)
    );
    if (!allowed) return failure("TOO_MANY_REQUESTS" as const);

    // EQ-06: vencido, usado, revogado ou inexistente são o mesmo erro.
    const code = normalizeInviteCode(request.code);
    const invite = code ? await this.inviteRepository.findByCode(code) : null;
    if (!invite || !invite.isActive(now)) return failure("INVITE_INVALID" as const);

    const clinic = await this.clinicRepository.findById(invite.clinicId);
    if (!clinic) return failure("INVITE_INVALID" as const);

    return success({ clinicName: clinic.name, role: invite.role, expiresAt: invite.expiresAt });
  }
}
