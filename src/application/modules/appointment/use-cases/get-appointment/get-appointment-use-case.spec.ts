import { describe, it, expect, vi, beforeEach } from "vitest";
import { failure, Uuid } from "@wave-telecom/framework/core";
import { GetAppointmentUseCase } from "./get-appointment-use-case";
import { Appointment } from "../../../../../domain/entities/appointment";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import {
  makeShareRepository,
  makeStudentAccess,
  makeStudentRepositoryFake,
  shareStudent,
} from "../../../../../domain/tests/fakes/student-share-fakes";
import { makeStudent } from "../../../session-evolution/use-cases/test-fixtures";

describe("GetAppointmentUseCase", () => {
  const ownerId = Uuid.random();
  const colleagueId = Uuid.random();
  const student = makeStudent(ownerId);
  const appointment = Appointment.create({
    educatorId: ownerId,
    studentId: student.id,
    scheduledAt: new Date("2026-11-10T13:00:00Z"),
  });

  let shareRepository: ReturnType<typeof makeShareRepository>;
  let useCase: GetAppointmentUseCase;

  beforeEach(() => {
    shareRepository = makeShareRepository();
    useCase = new GetAppointmentUseCase(
      { findById: vi.fn().mockResolvedValue(appointment) } as unknown as AppointmentRepository,
      makeStudentAccess(makeStudentRepositoryFake([student]), shareRepository)
    );
  });

  it("returns the appointment to its educator", async () => {
    const result = await useCase.execute({ id: appointment.id, educatorId: ownerId });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.id).toBe(appointment.id.value);
  });

  it("returns the appointment to a colleague with the shared student (EQ-11)", async () => {
    await shareRepository.create(shareStudent(student, colleagueId));

    const result = await useCase.execute({ id: appointment.id, educatorId: colleagueId });

    expect(result.ok).toBe(true);
  });

  it("returns NOT_FOUND to a colleague without the share, and again after unsharing", async () => {
    expect(await useCase.execute({ id: appointment.id, educatorId: colleagueId })).toEqual(
      failure("NOT_FOUND")
    );

    await shareRepository.create(shareStudent(student, colleagueId));
    await shareRepository.delete(student.id, colleagueId);

    expect(await useCase.execute({ id: appointment.id, educatorId: colleagueId })).toEqual(
      failure("NOT_FOUND")
    );
  });
});
