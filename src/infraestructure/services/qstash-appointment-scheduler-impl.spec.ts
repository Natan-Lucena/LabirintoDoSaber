import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { QStashAppointmentSchedulerImpl } from "./qstash-appointment-scheduler-impl";
import { AppointmentRepository } from "../../domain/repositories/appointment-repository";
import { Appointment, AppointmentStatus } from "../../domain/entities/appointment";

const mockAppointmentRepository = (): AppointmentRepository =>
  ({
    save: vi.fn(),
    findById: vi.fn(),
    delete: vi.fn(),
    search: vi.fn(),
  } as unknown as AppointmentRepository);

const DAY_MS = 24 * 60 * 60 * 1000;

const makeAppointment = (overrides: Partial<Parameters<typeof Appointment.create>[0]> = {}) =>
  Appointment.create({
    educatorId: Uuid.random(),
    studentId: Uuid.random(),
    scheduledAt: new Date(Date.now() + DAY_MS),
    ...overrides,
  });

describe("QStashAppointmentSchedulerImpl.cancel", () => {
  let repo: AppointmentRepository;
  let scheduler: QStashAppointmentSchedulerImpl;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    repo = mockAppointmentRepository();
    (repo.save as any).mockResolvedValue(undefined);
    (repo.search as any).mockResolvedValue([]);
    scheduler = new QStashAppointmentSchedulerImpl(repo);
    fetchMock = vi.fn().mockResolvedValue({ json: async () => ({ messageId: "msg-next" }) });
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should delete the message, clear metadata and schedule the next when cancelling the active leader", async () => {
    const leader = makeAppointment({
      status: AppointmentStatus.CANCELLED,
      metadata: { qstashMessageId: "msg-leader" },
    });
    const scheduleNextSpy = vi.spyOn(scheduler, "scheduleNext");

    await scheduler.cancel(leader);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock.mock.calls[0][0]).toContain("/v2/messages/msg-leader");
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
    const saved = (repo.save as any).mock.calls[0][0] as Appointment;
    expect(saved.metadata["qstashMessageId"]).toBeNull();
    expect(scheduleNextSpy).toHaveBeenCalledOnce();
  });

  it("should only clear metadata when the appointment was already notified", async () => {
    const notified = makeAppointment({
      status: AppointmentStatus.COMPLETED,
      notifiedAt: new Date(),
      metadata: { qstashMessageId: "msg-old" },
    });
    const scheduleNextSpy = vi.spyOn(scheduler, "scheduleNext");

    await scheduler.cancel(notified);

    expect(fetchMock).not.toHaveBeenCalled();
    const saved = (repo.save as any).mock.calls[0][0] as Appointment;
    expect(saved.metadata["qstashMessageId"]).toBeNull();
    expect(scheduleNextSpy).not.toHaveBeenCalled();
  });

  it("should only clear metadata when the appointment is in the past", async () => {
    const past = makeAppointment({
      scheduledAt: new Date(Date.now() - DAY_MS),
      status: AppointmentStatus.COMPLETED,
      metadata: { qstashMessageId: "msg-old" },
    });
    const scheduleNextSpy = vi.spyOn(scheduler, "scheduleNext");

    await scheduler.cancel(past);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(repo.save).toHaveBeenCalledOnce();
    expect(scheduleNextSpy).not.toHaveBeenCalled();
  });

  it("should do nothing when the appointment has no scheduled message", async () => {
    const scheduleNextSpy = vi.spyOn(scheduler, "scheduleNext");

    await scheduler.cancel(makeAppointment({ status: AppointmentStatus.CANCELLED }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
    expect(scheduleNextSpy).not.toHaveBeenCalled();
  });
});
