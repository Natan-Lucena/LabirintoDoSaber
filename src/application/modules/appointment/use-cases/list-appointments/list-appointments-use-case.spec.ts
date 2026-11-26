import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { ListAppointmentsUseCase } from "./list-appointments-use-case";
import { Appointment } from "../../../../../domain/entities/appointment";
import {
  AppointmentRepository,
  SearchAppointmentParams,
} from "../../../../../domain/repositories/appointment-repository";
import {
  makeShareRepository,
  makeStudentAccess,
  makeStudentRepositoryFake,
  shareStudent,
} from "../../../../../domain/tests/fakes/student-share-fakes";
import { makeStudent } from "../../../session-evolution/use-cases/test-fixtures";

describe("ListAppointmentsUseCase", () => {
  const educatorId = Uuid.random();
  const student = makeStudent(educatorId);
  const otherStudent = makeStudent(Uuid.random());
  const notShared = makeStudent(Uuid.random());
  const at = (iso: string) =>
    Appointment.create({ educatorId, studentId: student.id, scheduledAt: new Date(iso) });

  // 10/11 23:30 em SP; 11/11 00:00 e 23:59 em SP; 12/11 00:00 em SP.
  const beforeRange = at("2026-11-11T02:30:00.000Z");
  const startOfRange = at("2026-11-11T03:00:00.000Z");
  const endOfRange = at("2026-11-12T02:59:00.000Z");
  const afterRange = at("2026-11-12T03:00:00.000Z");
  const all = [beforeRange, startOfRange, endOfRange, afterRange];

  let repository: AppointmentRepository;
  let useCase: ListAppointmentsUseCase;

  beforeEach(() => {
    // Repositório em memória que respeita os limites inclusivos.
    repository = {
      search: vi.fn(async (params: SearchAppointmentParams) =>
        all.filter(
          (a) =>
            (!params.scheduledAfter || a.scheduledAt >= params.scheduledAfter) &&
            (!params.scheduledBefore || a.scheduledAt <= params.scheduledBefore)
        )
      ),
    } as unknown as AppointmentRepository;
    useCase = new ListAppointmentsUseCase(
      repository,
      makeStudentAccess(makeStudentRepositoryFake([student, otherStudent, notShared]), [
        shareStudent(otherStudent, educatorId),
      ])
    );
  });

  const ids = (result: any) => result.value.map((a: any) => a.id);

  it("should filter by from/to as whole days in Sao Paulo, `to` inclusive", async () => {
    const result = await useCase.execute({
      educatorId,
      from: "2026-11-11",
      to: "2026-11-11",
    });

    expect(result.ok).toBe(true);
    expect(ids(result)).toEqual([startOfRange.id.value, endOfRange.id.value]);
    expect(repository.search).toHaveBeenCalledWith({
      educatorId,
      studentId: undefined,
      scheduledAfter: new Date("2026-11-11T03:00:00.000Z"),
      scheduledBefore: new Date("2026-11-12T02:59:59.999Z"),
    });
  });

  it("should accept only one of the bounds", async () => {
    const result = await useCase.execute({ educatorId, from: "2026-11-12" });

    expect(ids(result)).toEqual([afterRange.id.value]);
  });

  it("should return everything without from/to", async () => {
    const result = await useCase.execute({ educatorId });

    expect(ids(result)).toEqual(all.map((a) => a.id.value));
    expect(repository.search).toHaveBeenCalledWith({
      educatorId,
      studentId: undefined,
      scheduledAfter: undefined,
      scheduledBefore: undefined,
    });
  });

  it("should return INVALID_PERIOD when from is after to", async () => {
    const result = await useCase.execute({
      educatorId,
      from: "2026-11-12",
      to: "2026-11-11",
    });

    expect(result).toEqual({ ok: false, error: "INVALID_PERIOD" });
    expect(repository.search).not.toHaveBeenCalled();
  });

  describe("por aluno (EQ-11)", () => {
    it("lists the appointments of an owned student from any educator", async () => {
      const result = await useCase.execute({ educatorId, studentId: student.id });

      expect(result.ok).toBe(true);
      expect(repository.search).toHaveBeenCalledWith({
        educatorId: undefined,
        studentId: student.id,
        scheduledAfter: undefined,
        scheduledBefore: undefined,
      });
    });

    it("lists the appointments of a student shared with the educator", async () => {
      const result = await useCase.execute({ educatorId, studentId: otherStudent.id });

      expect(result.ok).toBe(true);
      expect(repository.search).toHaveBeenCalledWith(
        expect.objectContaining({ educatorId: undefined, studentId: otherStudent.id })
      );
    });

    it("returns UNAUTHORIZED for a student not shared and STUDENT_NOT_FOUND for a missing one", async () => {
      const missing = Uuid.random();
      const notSharedResult = await useCase.execute({ educatorId, studentId: notShared.id });

      expect(notSharedResult).toEqual({ ok: false, error: "UNAUTHORIZED" });
      expect(await useCase.execute({ educatorId, studentId: missing })).toEqual({
        ok: false,
        error: "STUDENT_NOT_FOUND",
      });
      expect(repository.search).not.toHaveBeenCalled();
    });
  });
});
