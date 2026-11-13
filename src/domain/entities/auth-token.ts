import crypto from "crypto";
import { failure, Result, success, Uuid } from "@wave-telecom/framework/core";

const MINUTE_MS = 60 * 1000;
export const AUTH_TOKEN_TTL_MS = 15 * MINUTE_MS;
export const AUTH_TOKEN_MAX_ATTEMPTS = 5;
export const AUTH_TOKEN_SEND_LIMIT = 3;
export const AUTH_TOKEN_SEND_WINDOW_MS = 15 * MINUTE_MS;

export type AuthTokenCheckError =
  | "INVALID_TOKEN"
  | "EXPIRED_TOKEN"
  | "TOO_MANY_ATTEMPTS";

export interface AuthTokenProps {
  id: Uuid;
  userId: Uuid;
  tokenHash?: string;
  expiresAt?: Date;
  attempts: number;
  consumedAt?: Date;
  sendCount: number;
  sendWindowStart?: Date;
}

interface IssueAuthTokenProps {
  userId: Uuid;
  now: Date;
  previous?: AuthToken | null;
}

// HMAC com segredo do servidor: sem ele, o hash gravado não permite testar os
// 10^6 códigos possíveis.
function hashCode(code: string): string {
  const secret =
    process.env.PASSWORD_TOKEN_SECRET || process.env.JWT_SECRET || "dev-secret";
  return crypto.createHmac("sha256", secret).update(code).digest("hex");
}

// A janela de envios começou há menos de 15 minutos.
export function isSendWindowOpen(
  sendWindowStart: Date | undefined,
  now: Date
): boolean {
  return (
    !!sendWindowStart &&
    now.getTime() - sendWindowStart.getTime() < AUTH_TOKEN_SEND_WINDOW_MS
  );
}

// Código de recuperação de senha: 6 dígitos, uso único, válido por 15 minutos.
// Há um registro por educador; cada código novo sobrescreve o anterior.
// Contar tentativas, contar envios e consumir são operações atômicas do
// repositório; aqui ficam só as regras.
export class AuthToken {
  readonly id: Uuid;
  readonly userId: Uuid;
  readonly tokenHash: string | undefined;
  readonly expiresAt: Date | undefined;
  readonly attempts: number;
  readonly consumedAt: Date | undefined;
  readonly sendCount: number;
  readonly sendWindowStart: Date | undefined;

  private constructor(props: AuthTokenProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.tokenHash = props.tokenHash;
    this.expiresAt = props.expiresAt;
    this.attempts = props.attempts;
    this.consumedAt = props.consumedAt;
    this.sendCount = props.sendCount;
    this.sendWindowStart = props.sendWindowStart;
  }

  static fromPersistence(props: AuthTokenProps): AuthToken {
    return new AuthToken(props);
  }

  // Gera um código novo, respeitando o limite de envios da janela. Devolve o
  // código em claro só para o envio por e-mail; a entidade guarda o hash.
  static issue(
    props: IssueAuthTokenProps
  ): Result<{ authToken: AuthToken; code: string }, "TOO_MANY_REQUESTS"> {
    const { userId, now, previous } = props;

    const windowOpen = isSendWindowOpen(previous?.sendWindowStart, now);

    if (windowOpen && previous!.sendCount >= AUTH_TOKEN_SEND_LIMIT) {
      return failure("TOO_MANY_REQUESTS");
    }

    const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, "0");

    const authToken = new AuthToken({
      id: previous?.id ?? Uuid.random(),
      userId,
      tokenHash: hashCode(code),
      expiresAt: new Date(now.getTime() + AUTH_TOKEN_TTL_MS),
      attempts: 0,
      consumedAt: undefined,
      sendCount: windowOpen ? previous!.sendCount + 1 : 1,
      sendWindowStart: windowOpen ? previous!.sendWindowStart : now,
    });

    return success({ authToken, code });
  }

  // O código ainda pode ser conferido? Ordem: inexistente/usado, tentativas
  // esgotadas, vencido.
  ensureUsable(now: Date): Result<void, AuthTokenCheckError> {
    if (!this.tokenHash || !this.expiresAt || this.consumedAt) {
      return failure("INVALID_TOKEN");
    }
    if (this.attempts >= AUTH_TOKEN_MAX_ATTEMPTS) {
      return failure("TOO_MANY_ATTEMPTS");
    }
    if (this.expiresAt.getTime() < now.getTime()) {
      return failure("EXPIRED_TOKEN");
    }
    return success(undefined);
  }

  // Confere o código numa tentativa já contada pelo repositório. `attempts` é
  // o valor lido antes de contar: se esta for a 5ª tentativa errada, a
  // resposta já é TOO_MANY_ATTEMPTS.
  check(code: string, now: Date): Result<void, AuthTokenCheckError> {
    const usable = this.ensureUsable(now);
    if (!usable.ok) return usable;

    const received = Buffer.from(hashCode(code), "hex");
    const stored = Buffer.from(this.tokenHash!, "hex");
    const matches =
      received.length === stored.length &&
      crypto.timingSafeEqual(received, stored);

    if (!matches) {
      return failure(
        this.attempts + 1 >= AUTH_TOKEN_MAX_ATTEMPTS
          ? "TOO_MANY_ATTEMPTS"
          : "INVALID_TOKEN"
      );
    }

    return success(undefined);
  }
}
