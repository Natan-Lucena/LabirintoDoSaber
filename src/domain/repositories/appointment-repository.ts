import { Uuid } from "@wave-telecom/framework/core";
import { Appointment, AppointmentStatus } from "../entities/appointment";

export interface SearchAppointmentParams {
  educatorId?: Uuid;
  studentId?: Uuid;
  status?: AppointmentStatus;
  scheduledBefore?: Date;
  scheduledAfter?: Date;
  notified?: boolean;
  hasScheduledJob?: boolean;
  limit?: number;
}

export interface AppointmentRepository {
  save(appointment: Appointment): Promise<void>;
  findById(id: Uuid): Promise<Appointment | null>;
  search(params: SearchAppointmentParams): Promise<Appointment[]>;
  delete(id: Uuid): Promise<void>;
}
