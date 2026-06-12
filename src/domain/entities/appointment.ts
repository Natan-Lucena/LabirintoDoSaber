import { Uuid } from "@wave-telecom/framework/core";

export type AppointmentMetadata = Record<string, string | Date | null>;

export enum AppointmentStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export interface CreateAppointmentProps {
  id?: Uuid;
  educatorId: Uuid;
  studentId: Uuid;
  scheduledAt: Date;
  observation?: string;
  status?: AppointmentStatus;
  notifiedAt?: Date;
  metadata?: AppointmentMetadata;
  createdAt?: Date;
}

export interface UpdateAppointmentProps {
  scheduledAt?: Date;
  observation?: string | null;
}

export class Appointment {
  readonly id: Uuid;
  readonly educatorId: Uuid;
  readonly studentId: Uuid;
  readonly createdAt: Date;

  private _scheduledAt: Date;
  private _observation: string | undefined;
  private _status: AppointmentStatus;
  private _notifiedAt: Date | undefined;
  private _metadata: AppointmentMetadata;

  private constructor(props: Required<Omit<CreateAppointmentProps, "observation" | "notifiedAt">> & {
    observation?: string;
    notifiedAt?: Date;
  }) {
    this.id = props.id;
    this.educatorId = props.educatorId;
    this.studentId = props.studentId;
    this._scheduledAt = props.scheduledAt;
    this._observation = props.observation;
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

  get status(): AppointmentStatus {
    return this._status;
  }

  get notifiedAt(): Date | undefined {
    return this._notifiedAt;
  }

  get metadata(): AppointmentMetadata {
    return this._metadata;
  }

  update(props: UpdateAppointmentProps): Appointment {
    return new Appointment({
      id: this.id,
      educatorId: this.educatorId,
      studentId: this.studentId,
      scheduledAt: props.scheduledAt ?? this._scheduledAt,
      observation: props.observation === null ? undefined : (props.observation ?? this._observation),
      status: this._status,
      notifiedAt: this._notifiedAt,
      metadata: { ...this._metadata },
      createdAt: this.createdAt,
    });
  }

  cancel(): Appointment {
    return new Appointment({
      id: this.id,
      educatorId: this.educatorId,
      studentId: this.studentId,
      scheduledAt: this._scheduledAt,
      observation: this._observation,
      status: AppointmentStatus.CANCELLED,
      notifiedAt: this._notifiedAt,
      metadata: { ...this._metadata },
      createdAt: this.createdAt,
    });
  }

  markAsNotified(at: Date): Appointment {
    return new Appointment({
      id: this.id,
      educatorId: this.educatorId,
      studentId: this.studentId,
      scheduledAt: this._scheduledAt,
      observation: this._observation,
      status: this._status,
      notifiedAt: at,
      metadata: { ...this._metadata },
      createdAt: this.createdAt,
    });
  }

  withMetadata(key: string, value: string | Date | null): Appointment {
    return new Appointment({
      id: this.id,
      educatorId: this.educatorId,
      studentId: this.studentId,
      scheduledAt: this._scheduledAt,
      observation: this._observation,
      status: this._status,
      notifiedAt: this._notifiedAt,
      metadata: { ...this._metadata, [key]: value },
      createdAt: this.createdAt,
    });
  }
}
