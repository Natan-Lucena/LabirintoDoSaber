import { failure, Result, success, Uuid } from "@wave-telecom/framework/core";

export type AppointmentMetadata = Record<string, string | Date | null>;

export enum AppointmentStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 50;
export const MAX_APPOINTMENT_DURATION_MINUTES = 240;

const ALLOWED_TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  [AppointmentStatus.PENDING]: [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED],
  [AppointmentStatus.CANCELLED]: [AppointmentStatus.PENDING],
  [AppointmentStatus.COMPLETED]: [],
};

export interface CreateAppointmentProps {
  id?: Uuid;
  educatorId: Uuid;
  studentId: Uuid;
  scheduledAt: Date;
  observation?: string;
  type?: string;
  durationMinutes?: number;
  status?: AppointmentStatus;
  notifiedAt?: Date;
  metadata?: AppointmentMetadata;
  createdAt?: Date;
}

export interface UpdateAppointmentProps {
  scheduledAt?: Date;
  observation?: string | null;
  type?: string;
  durationMinutes?: number;
}

type AppointmentState = Required<
  Omit<CreateAppointmentProps, "observation" | "type" | "durationMinutes" | "notifiedAt">
> & {
  observation?: string;
  type?: string;
  durationMinutes?: number;
  notifiedAt?: Date;
};

export class Appointment {
  readonly id: Uuid;
  readonly educatorId: Uuid;
  readonly studentId: Uuid;
  readonly createdAt: Date;

  private _scheduledAt: Date;
  private _observation: string | undefined;
  private _type: string | undefined;
  private _durationMinutes: number | undefined;
  private _status: AppointmentStatus;
  private _notifiedAt: Date | undefined;
  private _metadata: AppointmentMetadata;

  private constructor(props: AppointmentState) {
    this.id = props.id;
    this.educatorId = props.educatorId;
    this.studentId = props.studentId;
    this._scheduledAt = props.scheduledAt;
    this._observation = props.observation;
    this._type = props.type;
    this._durationMinutes = props.durationMinutes;
    this._status = props.status;
    this._notifiedAt = props.notifiedAt;
    this._metadata = props.metadata;
    this.createdAt = props.createdAt;
  }

  static create(props: CreateAppointmentProps): Appointment {
    return new Appointment({
      id: props.id ?? Uuid.random(),
      educatorId: props.educatorId,
      studentId: props.studentId,
      scheduledAt: props.scheduledAt,
      observation: props.observation,
      type: props.type,
      durationMinutes: props.durationMinutes,
      status: props.status ?? AppointmentStatus.PENDING,
      notifiedAt: props.notifiedAt,
      metadata: props.metadata ?? {},
      createdAt: props.createdAt ?? new Date(),
    });
  }

  get scheduledAt(): Date {
    return this._scheduledAt;
  }

  get observation(): string | undefined {
    return this._observation;
  }

  get type(): string | undefined {
    return this._type;
  }

  /** Registros antigos não têm duração gravada: assumem o padrão de 50 minutos. */
  get durationMinutes(): number {
    return this._durationMinutes ?? DEFAULT_APPOINTMENT_DURATION_MINUTES;
  }

  get endsAt(): Date {
    return new Date(this._scheduledAt.getTime() + this.durationMinutes * 60_000);
  }

  get status(): AppointmentStatus {
    return this._status;
  }

  get notifiedAt(): Date | undefined {
    return this._notifiedAt;
  }

  get metadata(): AppointmentMetadata {
    return this._metadata;
  }

  get canBeRescheduled(): boolean {
    return this._status === AppointmentStatus.PENDING;
  }

  update(props: UpdateAppointmentProps): Result<Appointment, "APPOINTMENT_NOT_EDITABLE"> {
    const changesSchedule =
      (props.scheduledAt !== undefined && props.scheduledAt.getTime() !== this._scheduledAt.getTime()) ||
      (props.type !== undefined && props.type !== this._type) ||
      (props.durationMinutes !== undefined && props.durationMinutes !== this.durationMinutes);

    if (changesSchedule && !this.canBeRescheduled) {
      return failure("APPOINTMENT_NOT_EDITABLE");
    }

    return success(
      this.copy({
        scheduledAt: props.scheduledAt ?? this._scheduledAt,
        observation: props.observation === null ? undefined : (props.observation ?? this._observation),
        type: props.type ?? this._type,
        durationMinutes: props.durationMinutes ?? this._durationMinutes,
      })
    );
  }

  changeStatus(next: AppointmentStatus): Result<Appointment, "INVALID_STATUS_TRANSITION"> {
    if (next === this._status) {
      return success(this);
    }

    if (!ALLOWED_TRANSITIONS[this._status].includes(next)) {
      return failure("INVALID_STATUS_TRANSITION");
    }

    return success(this.copy({ status: next }));
  }

  /** Intervalos semiabertos [início, fim): atendimentos encostados não se sobrepõem. */
  overlaps(other: Appointment): boolean {
    return this._scheduledAt < other.endsAt && other.scheduledAt < this.endsAt;
  }

  cancel(): Appointment {
    return this.copy({ status: AppointmentStatus.CANCELLED });
  }

  markAsNotified(at: Date): Appointment {
    return this.copy({ notifiedAt: at });
  }

  withMetadata(key: string, value: string | Date | null): Appointment {
    return this.copy({ metadata: { ...this._metadata, [key]: value } });
  }

  private copy(overrides: Partial<AppointmentState>): Appointment {
    return new Appointment({
      id: this.id,
      educatorId: this.educatorId,
      studentId: this.studentId,
      scheduledAt: this._scheduledAt,
      observation: this._observation,
      type: this._type,
      durationMinutes: this._durationMinutes,
      status: this._status,
      notifiedAt: this._notifiedAt,
      metadata: { ...this._metadata },
      createdAt: this.createdAt,
      ...overrides,
    });
  }
}
