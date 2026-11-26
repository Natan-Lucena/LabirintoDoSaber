import { failure, Result, success, Uuid } from "@wave-telecom/framework/core";
import { Appointment, DEFAULT_APPOINTMENT_DURATION_MINUTES } from "./appointment";
import {
  addDays,
  atTimeInSaoPaulo,
  dateInSaoPaulo,
  timeInSaoPaulo,
} from "../utils/date-only";

export enum RecurrenceFrequency {
  WEEKLY = "WEEKLY",
  BIWEEKLY = "BIWEEKLY",
}

export const MIN_SERIES_OCCURRENCES = 2;
export const MAX_SERIES_OCCURRENCES = 26;
// RC-01: no máximo 6 meses. occurrences × intervalo não passa disso
// (26 semanais ou 13 quinzenais).
export const MAX_SERIES_SPAN_DAYS = 183;

const INTERVAL_DAYS: Record<RecurrenceFrequency, number> = {
  [RecurrenceFrequency.WEEKLY]: 7,
  [RecurrenceFrequency.BIWEEKLY]: 14,
};

export interface AppointmentSeriesProps {
  id: Uuid;
  studentId: Uuid;
  educatorId: Uuid;
  frequency: RecurrenceFrequency;
  // Dia da semana e horário de São Paulo de todas as ocorrências (RC-02).
  firstScheduledAt: Date;
  occurrences: number;
  type?: string;
  durationMinutes: number;
  observation?: string;
  endedAt?: Date;
  createdAt: Date;
}

export interface CreateAppointmentSeriesProps {
  studentId: Uuid;
  educatorId: Uuid;
  frequency: RecurrenceFrequency;
  firstScheduledAt: Date;
  occurrences: number;
  type?: string;
  durationMinutes?: number;
  observation?: string;
  now?: Date;
}

// Ocorrência pulada por conflito com outro atendimento PENDING do educador
// (RC-03, RC-05).
export interface SkippedOccurrence {
  // Ocorrência que ficou como estava (só na edição da série).
  appointmentId?: string;
  scheduledAt: Date;
  reason: "CONFLICT";
  conflictingAppointmentId: string;
}

export interface SeriesResult {
  series: AppointmentSeries;
  created: Appointment[];
  skipped: SkippedOccurrence[];
}

// Atendimentos recorrentes (semanais ou quinzenais). As ocorrências são
// materializadas como Appointment comuns com seriesId (RC-01); a série guarda
// a regra de criação e quando foi encerrada.
export class AppointmentSeries {
  private constructor(private readonly props: AppointmentSeriesProps) {}

  static create(
    props: CreateAppointmentSeriesProps
  ): Result<AppointmentSeries, "INVALID_OCCURRENCES" | "SERIES_TOO_LONG"> {
    if (
      !Number.isInteger(props.occurrences) ||
      props.occurrences < MIN_SERIES_OCCURRENCES ||
      props.occurrences > MAX_SERIES_OCCURRENCES
    ) {
      return failure("INVALID_OCCURRENCES");
    }

    if (props.occurrences * INTERVAL_DAYS[props.frequency] > MAX_SERIES_SPAN_DAYS) {
      return failure("SERIES_TOO_LONG");
    }

    return success(
      new AppointmentSeries({
        id: Uuid.random(),
        studentId: props.studentId,
        educatorId: props.educatorId,
        frequency: props.frequency,
        firstScheduledAt: props.firstScheduledAt,
        occurrences: props.occurrences,
        type: props.type,
        durationMinutes: props.durationMinutes ?? DEFAULT_APPOINTMENT_DURATION_MINUTES,
        observation: props.observation,
        createdAt: props.now ?? new Date(),
      })
    );
  }

  static fromPersistence(props: AppointmentSeriesProps): AppointmentSeries {
    return new AppointmentSeries(props);
  }

  get id(): Uuid {
    return this.props.id;
  }

  get studentId(): Uuid {
    return this.props.studentId;
  }

  get educatorId(): Uuid {
    return this.props.educatorId;
  }

  get frequency(): RecurrenceFrequency {
    return this.props.frequency;
  }

  get firstScheduledAt(): Date {
    return this.props.firstScheduledAt;
  }

  get occurrences(): number {
    return this.props.occurrences;
  }

  get type(): string | undefined {
    return this.props.type;
  }

  get durationMinutes(): number {
    return this.props.durationMinutes;
  }

  get observation(): string | undefined {
    return this.props.observation;
  }

  get endedAt(): Date | undefined {
    return this.props.endedAt;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }

  get isEnded(): boolean {
    return this.props.endedAt !== undefined;
  }

  // RC-02: soma dias no calendário de São Paulo e repete a hora local da
  // primeira, em vez de somar milissegundos ao instante.
  occurrenceDates(): Date[] {
    const firstDate = dateInSaoPaulo(this.props.firstScheduledAt);
    const time = timeInSaoPaulo(this.props.firstScheduledAt);
    const interval = INTERVAL_DAYS[this.props.frequency];

    return Array.from({ length: this.props.occurrences }, (_, index) =>
      atTimeInSaoPaulo(addDays(firstDate, index * interval), time)
    );
  }

  // RC-06. Encerrar de novo mantém a primeira data.
  end(at: Date): AppointmentSeries {
    if (this.isEnded) return this;
    return new AppointmentSeries({ ...this.props, endedAt: at });
  }
}
