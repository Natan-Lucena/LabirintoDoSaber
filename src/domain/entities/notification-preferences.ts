import { Uuid } from "@wave-telecom/framework/core";
import { NotificationKind } from "./notification";

export type NotificationKindToggles = Record<NotificationKind, boolean>;

export interface NotificationPreferencesProps {
  id: Uuid;
  educatorId: Uuid;
  pushEnabled: boolean;
  // Guarda só os desligados: um kind novo nasce ligado.
  disabledKinds: NotificationKind[];
  updatedAt: Date;
}

export interface NotificationPreferencesChanges {
  pushEnabled?: boolean;
  kinds?: Partial<NotificationKindToggles>;
}

// Preferências de push do educador (PU-06). Só afetam o push; a lista de
// notificações continua com tudo.
export class NotificationPreferences {
  private constructor(private readonly props: NotificationPreferencesProps) {}

  // Sem registro salvo: push ligado e todos os kinds ligados.
  static defaults(educatorId: Uuid, now: Date = new Date()): NotificationPreferences {
    return new NotificationPreferences({
      id: Uuid.random(),
      educatorId,
      pushEnabled: true,
      disabledKinds: [],
      updatedAt: now,
    });
  }

  static fromPersistence(props: NotificationPreferencesProps): NotificationPreferences {
    return new NotificationPreferences(props);
  }

  // Parcial: o que não veio fica como estava.
  update(
    changes: NotificationPreferencesChanges,
    now: Date = new Date()
  ): NotificationPreferences {
    const disabled = new Set(this.props.disabledKinds);
    for (const [kind, enabled] of Object.entries(changes.kinds ?? {})) {
      if (enabled === undefined) continue;
      if (enabled) disabled.delete(kind as NotificationKind);
      else disabled.add(kind as NotificationKind);
    }

    return new NotificationPreferences({
      ...this.props,
      pushEnabled: changes.pushEnabled ?? this.props.pushEnabled,
      disabledKinds: Object.values(NotificationKind).filter((kind) => disabled.has(kind)),
      updatedAt: now,
    });
  }

  allowsPush(kind: NotificationKind): boolean {
    return this.props.pushEnabled && !this.props.disabledKinds.includes(kind);
  }

  get id(): Uuid {
    return this.props.id;
  }

  get educatorId(): Uuid {
    return this.props.educatorId;
  }

  get pushEnabled(): boolean {
    return this.props.pushEnabled;
  }

  get disabledKinds(): NotificationKind[] {
    return [...this.props.disabledKinds];
  }

  get kinds(): NotificationKindToggles {
    return Object.fromEntries(
      Object.values(NotificationKind).map((kind) => [
        kind,
        !this.props.disabledKinds.includes(kind),
      ])
    ) as NotificationKindToggles;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }
}
