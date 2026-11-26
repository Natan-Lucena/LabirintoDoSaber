// Repositórios em memória do push para os specs do módulo de notificações.
import { vi } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { PushToken } from "../../../../domain/entities/push-token";
import { NotificationPreferences } from "../../../../domain/entities/notification-preferences";
import { PushTokenRepository } from "../../../../domain/repositories/push-token-repository";
import { NotificationPreferencesRepository } from "../../../../domain/repositories/notification-preferences-repository";
import { PushDispatchRepository } from "../../../../domain/repositories/push-dispatch-repository";
import {
  PendingPushReceipt,
  PushReceiptRepository,
} from "../../../../domain/repositories/push-receipt-repository";

// Respeita o índice único em token, como o repositório Prisma.
export const makePushTokenRepository = () => {
  const store: PushToken[] = [];
  const repository = {
    store,
    findByToken: vi.fn(async (token: string) => store.find((t) => t.token === token) ?? null),
    save: vi.fn(async (pushToken: PushToken) => {
      const index = store.findIndex((t) => t.id.value === pushToken.id.value);
      if (index >= 0) store[index] = pushToken;
      else store.push(pushToken);
    }),
    listByEducatorIds: vi.fn(async (ids: Uuid[]) => {
      const wanted = new Set(ids.map((id) => id.value));
      return store.filter((t) => wanted.has(t.educatorId.value));
    }),
    deleteByIds: vi.fn(async (ids: Uuid[]) => {
      const gone = new Set(ids.map((id) => id.value));
      const kept = store.filter((t) => !gone.has(t.id.value));
      store.splice(0, store.length, ...kept);
    }),
    deleteForEducator: vi.fn(async (token: string, educatorId: Uuid) => {
      const kept = store.filter(
        (t) => !(t.token === token && t.educatorId.value === educatorId.value)
      );
      store.splice(0, store.length, ...kept);
    }),
    deleteByTokens: vi.fn(async (tokens: string[]) => {
      const before = store.length;
      const kept = store.filter((t) => !tokens.includes(t.token));
      store.splice(0, store.length, ...kept);
      return before - kept.length;
    }),
  };
  return repository as typeof repository & PushTokenRepository;
};

export const makePreferencesRepository = () => {
  const store: NotificationPreferences[] = [];
  const repository = {
    store,
    findByEducatorId: vi.fn(
      async (educatorId: Uuid) =>
        store.find((p) => p.educatorId.value === educatorId.value) ?? null
    ),
    listByEducatorIds: vi.fn(async (ids: Uuid[]) => {
      const wanted = new Set(ids.map((id) => id.value));
      return store.filter((p) => wanted.has(p.educatorId.value));
    }),
    save: vi.fn(async (preferences: NotificationPreferences) => {
      const index = store.findIndex((p) => p.id.value === preferences.id.value);
      if (index >= 0) store[index] = preferences;
      else store.push(preferences);
    }),
  };
  return repository as typeof repository & NotificationPreferencesRepository;
};

// Chave única educatorId + dia, como o índice do Prisma.
export const makeDispatchRepository = () => {
  const claimed = new Map<string, Date>();
  const repository = {
    claimed,
    claim: vi.fn(async (educatorId: Uuid, date: string, now: Date) => {
      const key = `${educatorId.value}:${date}`;
      if (claimed.has(key)) return false;
      claimed.set(key, now);
      return true;
    }),
    deleteCreatedBefore: vi.fn(async (date: Date) => {
      let deleted = 0;
      for (const [key, createdAt] of claimed) {
        if (createdAt < date) {
          claimed.delete(key);
          deleted++;
        }
      }
      return deleted;
    }),
  };
  return repository as typeof repository & PushDispatchRepository;
};

export const makeReceiptRepository = () => {
  const store: PendingPushReceipt[] = [];
  const repository = {
    store,
    saveMany: vi.fn(async (receipts: PendingPushReceipt[]) => {
      store.push(...receipts);
    }),
    listAll: vi.fn(async () => [...store]),
    deleteByIds: vi.fn(async (ids: string[]) => {
      const kept = store.filter((r) => !ids.includes(r.receiptId));
      store.splice(0, store.length, ...kept);
    }),
    deleteCreatedBefore: vi.fn(async (date: Date) => {
      const before = store.length;
      const kept = store.filter((r) => r.createdAt >= date);
      store.splice(0, store.length, ...kept);
      return before - kept.length;
    }),
  };
  return repository as typeof repository & PushReceiptRepository;
};
