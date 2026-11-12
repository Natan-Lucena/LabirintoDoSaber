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

export interface AuthTokenCheck {
  result: Result<void, AuthTokenCheckError>;
  // Instância depois da conferência: com a tentativa contada, quando o código
  // está errado. Se for diferente da original, precisa ser gravada.
  authToken: AuthToken;
}

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

// Código de recuperação de senha: 6 dígitos, uso único, válido por 15 minutos.
// Há um registro por educador; cada código novo sobrescreve o anterior.
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

    const windowOpen =
      !!previous?.sendWindowStart &&
      now.getTime() - previous.sendWindowStart.getTime() <
        AUTH_TOKEN_SEND_WINDOW_MS;

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

  check(code: string, now: Date): AuthTokenCheck {
    if (!this.tokenHash || !this.expiresAt || this.consumedAt) {
      return { result: failure("INVALID_TOKEN"), authToken: this };
    }

    if (this.attempts >= AUTH_TOKEN_MAX_ATTEMPTS) {
      return { result: failure("TOO_MANY_ATTEMPTS"), authToken: this };
    }

    if (this.expiresAt.getTime() < now.getTime()) {
      return { result: failure("EXPIRED_TOKEN"), authToken: this };
    }

    const received = Buffer.from(hashCode(code), "hex");
    const stored = Buffer.from(this.tokenHash, "hex");
    const matches =
      received.length === stored.length &&
      crypto.timingSafeEqual(received, stored);

    if (!matches) {
      const attempts = this.attempts + 1;
      return {
        result: failure(
          attempts >= AUTH_TOKEN_MAX_ATTEMPTS
            ? "TOO_MANY_ATTEMPTS"
            : "INVALID_TOKEN"
        ),
        authToken: new AuthToken({ ...this.toProps(), attempts }),
      };
    }

    return { result: success(undefined), authToken: this };
  }

  consume(now: Date): AuthToken {
    return new AuthToken({ ...this.toProps(), consumedAt: now });
  }

  private toProps(): AuthTokenProps {
    return {
      id: this.id,
      userId: this.userId,
      tokenHash: this.tokenHash,
      expiresAt: this.expiresAt,
      attempts: this.attempts,
      consumedAt: this.consumedAt,
      sendCount: this.sendCount,
      sendWindowStart: this.sendWindowStart,
    };
  }
}
