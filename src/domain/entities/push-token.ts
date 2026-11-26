import { failure, Result, success, Uuid } from "@wave-telecom/framework/core";

export type PushPlatform = "android" | "ios";
export const PUSH_PLATFORMS: readonly PushPlatform[] = ["android", "ios"];

// PU-01: até 5 aparelhos por educador; o visto há mais tempo sai.
export const MAX_PUSH_TOKENS_PER_EDUCATOR = 5;
export const PUSH_TOKEN_MAX = 255;

// Formatos da Expo: ExponentPushToken[...] (antigo) e ExpoPushToken[...].
const EXPO_PUSH_TOKEN = /^Expo(nent)?PushToken\[[^\[\]\s]+\]$/;

export const isExpoPushToken = (token: string) =>
  token.length <= PUSH_TOKEN_MAX && EXPO_PUSH_TOKEN.test(token);

export interface PushTokenProps {
  id: Uuid;
  token: string;
  educatorId: Uuid;
  platform: PushPlatform;
  createdAt: Date;
  lastSeenAt: Date;
}

export class PushToken {
  private constructor(private readonly props: PushTokenProps) {}

  static create(props: {
    token: string;
    educatorId: Uuid;
    platform: PushPlatform;
    now?: Date;
  }): Result<PushToken, "INVALID_PUSH_TOKEN"> {
    const token = props.token.trim();
    if (!isExpoPushToken(token)) return failure("INVALID_PUSH_TOKEN");

    const now = props.now ?? new Date();
    return success(
      new PushToken({
        id: Uuid.random(),
        token,
        educatorId: props.educatorId,
        platform: props.platform,
        createdAt: now,
        lastSeenAt: now,
      })
    );
  }

  static fromPersistence(props: PushTokenProps): PushToken {
    return new PushToken(props);
  }

  // Registrado de novo: o aparelho passa para quem está logado agora.
  seenBy(props: { educatorId: Uuid; platform: PushPlatform; now?: Date }): PushToken {
    return new PushToken({
      ...this.props,
      educatorId: props.educatorId,
      platform: props.platform,
      lastSeenAt: props.now ?? new Date(),
    });
  }

  get id(): Uuid {
    return this.props.id;
  }

  get token(): string {
    return this.props.token;
  }

  get educatorId(): Uuid {
    return this.props.educatorId;
  }

  get platform(): PushPlatform {
    return this.props.platform;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get lastSeenAt(): Date {
    return this.props.lastSeenAt;
  }
}
