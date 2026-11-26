import { z } from "zod";
import { PUSH_TOKEN_MAX } from "../../../../domain/entities/push-token";

const token = z.string().trim().min(1).max(PUSH_TOKEN_MAX);

// O formato da Expo é conferido na entidade (INVALID_PUSH_TOKEN).
export const registerPushTokenSchema = z.object({
  token,
  platform: z.enum(["android", "ios"]),
});

export const unregisterPushTokenSchema = z.object({ token });

const kinds = z
  .object({
    APPOINTMENTS_TODAY: z.boolean().optional(),
    EVOLUTION_PENDING: z.boolean().optional(),
    PLAN_REVIEW_DUE: z.boolean().optional(),
    SCALE_DRAFT_STALE: z.boolean().optional(),
  })
  .strict();

// Parcial: só o que veio muda.
export const updateNotificationPreferencesSchema = z
  .object({
    pushEnabled: z.boolean().optional(),
    kinds: kinds.optional(),
  })
  .strict();
