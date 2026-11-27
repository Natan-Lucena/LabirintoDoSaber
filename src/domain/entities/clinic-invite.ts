import crypto from "crypto";
import { Uuid } from "@wave-telecom/framework/core";
import { TeamRole } from "./clinic";

// Sem 0/O e 1/I, que se confundem ao ditar ou digitar o código (32 símbolos).
export const INVITE_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 8;
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const MAX_ACTIVE_INVITES = 20;

const INVITE_CODE_REGEX = new RegExp(
  `^[${INVITE_CODE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`
);

// Código de convite com sorteio criptográfico. `randomInt` é injetável só
// para os testes.
export function generateInviteCode(
  randomInt: (max: number) => number = (max) => crypto.randomInt(max)
): string {
  let code = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

// O código como o usuário digitou: sem espaços nas pontas, em maiúsculas.
// Devolve undefined quando não tem o formato de um código.
export function normalizeInviteCode(code: string): string | undefined {
  const normalized = code.trim().toUpperCase();
  return INVITE_CODE_REGEX.test(normalized) ? normalized : undefined;
}

function dayMonthInSaoPaulo(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

export interface ClinicInviteProps {
  id: Uuid;
  clinicId: Uuid;
  code: string;
  role: TeamRole;
  createdBy: Uuid;
  createdAt: Date;
  expiresAt: Date;
  usedAt?: Date;
  usedBy?: Uuid;
  revokedAt?: Date;
}

// Convite para a clínica (EQ-04): código de 8, uso único, vale 7 dias, papel
// definido na criação. Consumir é uma operação atômica do repositório.
export class ClinicInvite {
  private constructor(private readonly props: ClinicInviteProps) {}

  static create(props: {
    clinicId: Uuid;
    role: TeamRole;
    createdBy: Uuid;
    now?: Date;
    code?: string;
  }): ClinicInvite {
    const now = props.now ?? new Date();
    return new ClinicInvite({
      id: Uuid.random(),
      clinicId: props.clinicId,
      code: props.code ?? generateInviteCode(),
      role: props.role,
      createdBy: props.createdBy,
      createdAt: now,
      expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
    });
  }

  static fromPersistence(props: ClinicInviteProps): ClinicInvite {
    return new ClinicInvite(props);
  }

  // Pode ser aceito: não usado, não revogado e dentro da validade.
  isActive(now: Date): boolean {
    return (
      !this.props.usedAt &&
      !this.props.revokedAt &&
      this.props.expiresAt.getTime() > now.getTime()
    );
  }

  revoke(now: Date): ClinicInvite {
    if (this.props.revokedAt) return this;
    return new ClinicInvite({ ...this.props, revokedAt: now });
  }

  // EQ-05: texto para o ADMIN repassar, sem link. Data em São Paulo.
  shareMessage(clinicName: string): string {
    return (
      `Use o código ${this.props.code} para entrar na equipe ${clinicName} ` +
      `no app Labirinto do Saber. Vale até ${dayMonthInSaoPaulo(this.props.expiresAt)}.`
    );
  }

  get id(): Uuid {
    return this.props.id;
  }

  get clinicId(): Uuid {
    return this.props.clinicId;
  }

  get code(): string {
    return this.props.code;
  }

  get role(): TeamRole {
    return this.props.role;
  }

  get createdBy(): Uuid {
    return this.props.createdBy;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get expiresAt(): Date {
    return this.props.expiresAt;
  }

  get usedAt(): Date | undefined {
    return this.props.usedAt;
  }

  get usedBy(): Uuid | undefined {
    return this.props.usedBy;
  }

  get revokedAt(): Date | undefined {
    return this.props.revokedAt;
  }
}
