import { z } from "zod";
import { NotificationKind } from "../../../../domain/entities/notification";
import { PUSH_TOKEN_MAX } from "../../../../domain/entities/push-token";

const token = z.string().trim().min(1).max(PUSH_TOKEN_MAX);

// O formato da Expo é conferido na entidade (INVALID_PUSH_TOKEN).
export const registerPushTokenSchema = z.object({
  token,
  platform: z.enum(["android", "ios"]),
});

export const unregisterPushTokenSchema = z.object({ token });

// Uma chave opcional por NotificationKind; chave desconhecida é 400.
const kinds = z
  .object(
    Object.fromEntries(
      Object.values(NotificationKind).map((kind) => [kind, z.boolean().optional()])
    ) as Record<NotificationKind, z.ZodOptional<z.ZodBoolean>>
  )
  .strict();

// Parcial: só o que veio muda.
export const updateNotificationPreferencesSchema = z
  .object({
    pushEnabled: z.boolean().optional(),
    kinds: kinds.optional(),
  })
  .strict();
