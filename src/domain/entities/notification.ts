import { Uuid } from "@wave-telecom/framework/core";

export enum NotificationKind {
  APPOINTMENTS_TODAY = "APPOINTMENTS_TODAY",
  EVOLUTION_PENDING = "EVOLUTION_PENDING",
  PLAN_REVIEW_DUE = "PLAN_REVIEW_DUE",
  SCALE_DRAFT_STALE = "SCALE_DRAFT_STALE",
}

export enum NotificationTargetType {
  AGENDA_DAY = "AGENDA_DAY",
  SESSION = "SESSION",
  PLAN = "PLAN",
  SCALE_APPLICATION = "SCALE_APPLICATION",
}

export const NOTIFICATION_TITLE_MAX = 80;
export const NOTIFICATION_BODY_MAX = 200;
export const NOTIFICATION_RETENTION_DAYS = 90;

// O destino guarda só o id; se ele não existir mais, não é erro (NT-05).
export interface NotificationTarget {
  type: NotificationTargetType;
  id: string;
}

export interface NotificationProps {
  id: Uuid;
  educatorId: Uuid;
  kind: NotificationKind;
  title: string;
  body: string;
  target?: NotificationTarget;
  // Aluno da notificação: some da lista se deixar de ser do educador (NT-03).
  studentId?: Uuid;
  // Uma por kind + alvo + dia (NT-02).
  dedupeKey: string;
  createdAt: Date;
  readAt?: Date;
}

interface DailyProps {
  educatorId: Uuid;
  // Dia da geração em São Paulo, AAAA-MM-DD.
  date: string;
  now?: Date;
}

interface StudentProps extends DailyProps {
  studentId: Uuid;
  // Só o primeiro nome do paciente vai para o texto.
  firstName: string;
}

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1)}…` : text;

// AAAA-MM-DD → DD/MM
const dayMonth = (dateOnly: string) => {
  const [, month, day] = dateOnly.split("-");
  return `${day}/${month}`;
};

export class Notification {
  private constructor(private readonly props: NotificationProps) {}

  private static build(
    props: DailyProps & {
      kind: NotificationKind;
      title: string;
      body: string;
      target: NotificationTarget;
      studentId?: Uuid;
    }
  ): Notification {
    return new Notification({
      id: Uuid.random(),
      educatorId: props.educatorId,
      kind: props.kind,
      title: clip(props.title, NOTIFICATION_TITLE_MAX),
      body: clip(props.body, NOTIFICATION_BODY_MAX),
      target: props.target,
      studentId: props.studentId,
      dedupeKey:
        props.kind === NotificationKind.APPOINTMENTS_TODAY
          ? `${props.educatorId.value}:${props.kind}:${props.date}`
          : `${props.educatorId.value}:${props.kind}:${props.target.id}:${props.date}`,
      createdAt: props.now ?? new Date(),
    });
  }

  static appointmentsToday(props: DailyProps & { count: number }) {
    const noun = props.count === 1 ? "atendimento" : "atendimentos";
    return Notification.build({
      ...props,
      kind: NotificationKind.APPOINTMENTS_TODAY,
      title: `${props.count} ${noun} hoje`,
      body: `Você tem ${props.count} ${noun} marcado${props.count === 1 ? "" : "s"} para hoje.`,
      target: { type: NotificationTargetType.AGENDA_DAY, id: props.date },
    });
  }

  static evolutionPending(props: StudentProps & { sessionId: Uuid }) {
    return Notification.build({
      ...props,
      kind: NotificationKind.EVOLUTION_PENDING,
      title: "Evolução pendente",
      body: `A sessão de ${props.firstName} foi finalizada e ainda não tem evolução registrada.`,
      target: { type: NotificationTargetType.SESSION, id: props.sessionId.value },
    });
  }

  static planReviewDue(props: StudentProps & { planId: Uuid; nextReviewDate: string }) {
    const verb = props.nextReviewDate < props.date ? "venceu" : "vence";
    return Notification.build({
      ...props,
      kind: NotificationKind.PLAN_REVIEW_DUE,
      title: "Revisão de plano",
      body: `A revisão do plano de ${props.firstName} ${verb} em ${dayMonth(props.nextReviewDate)}.`,
      target: { type: NotificationTargetType.PLAN, id: props.planId.value },
    });
  }

  static scaleDraftStale(
    props: StudentProps & { applicationId: Uuid; templateName: string; days: number }
  ) {
    return Notification.build({
      ...props,
      kind: NotificationKind.SCALE_DRAFT_STALE,
      title: "Escala em rascunho",
      body: `A aplicação de ${props.templateName} de ${props.firstName} está parada há ${props.days} dias.`,
      target: {
        type: NotificationTargetType.SCALE_APPLICATION,
        id: props.applicationId.value,
      },
    });
  }

  static fromPersistence(props: NotificationProps): Notification {
    return new Notification(props);
  }

  get id(): Uuid {
    return this.props.id;
  }

  get educatorId(): Uuid {
    return this.props.educatorId;
  }

  get kind(): NotificationKind {
    return this.props.kind;
  }

  get title(): string {
    return this.props.title;
  }

  get body(): string {
    return this.props.body;
  }

  get target(): NotificationTarget | undefined {
    return this.props.target;
  }

  get studentId(): Uuid | undefined {
    return this.props.studentId;
  }

  get dedupeKey(): string {
    return this.props.dedupeKey;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get readAt(): Date | undefined {
    return this.props.readAt;
  }

  get isRead(): boolean {
    return this.props.readAt !== undefined;
  }

  // Já lida: mantém a data da primeira leitura.
  markRead(now: Date = new Date()): Notification {
    if (this.isRead) return this;
    return new Notification({ ...this.props, readAt: now });
  }
}
