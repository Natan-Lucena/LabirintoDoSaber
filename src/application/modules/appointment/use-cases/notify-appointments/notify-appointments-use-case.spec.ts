import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { NotifyAppointmentsUseCase } from "./notify-appointments-use-case";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { AppointmentSchedulerService } from "../../../../../domain/services/appointment-scheduler-service";
import { MailService } from "../../../../../domain/services/mail-service";
import { Appointment } from "../../../../../domain/entities/appointment";

const mockAppointmentRepository = (): AppointmentRepository =>
  ({
    save: vi.fn(),
    findById: vi.fn(),
    delete: vi.fn(),
    search: vi.fn(),
  } as unknown as AppointmentRepository);

const mockSchedulerService = (): AppointmentSchedulerService =>
  ({
    ensureScheduled: vi.fn(),
    cancel: vi.fn(),
    scheduleNext: vi.fn(),
  } as unknown as AppointmentSchedulerService);

const mockEducatorRepository = (): EducatorRepository =>
  ({
    save: vi.fn(),
    search: vi.fn(),
    getByEmail: vi.fn(),
    delete: vi.fn(),
  } as unknown as EducatorRepository);

const mockMailService = (): MailService =>
  ({
    sendAppointmentReminder: vi.fn(),
  } as unknown as MailService);

const fakeEducator = { email: "educator@test.com" } as any;

const makeAppointment = () =>
  Appointment.create({
    educatorId: Uuid.random(),
    studentId: Uuid.random(),
    scheduledAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min from now
  });

describe("NotifyAppointmentsUseCase", () => {
  let appointmentRepository: AppointmentRepository;
  let educatorRepository: EducatorRepository;
  let schedulerService: AppointmentSchedulerService;
  let mailService: MailService;
  let useCase: NotifyAppointmentsUseCase;

  beforeEach(() => {
    vi.restoreAllMocks();
    appointmentRepository = mockAppointmentRepository();
    educatorRepository = mockEducatorRepository();
    schedulerService = mockSchedulerService();
    mailService = mockMailService();
    useCase = new NotifyAppointmentsUseCase(
      appointmentRepository,
      educatorRepository,
      schedulerService,
      mailService
    );

    (appointmentRepository.save as any).mockResolvedValue(undefined);
    (educatorRepository.search as any).mockResolvedValue([fakeEducator]);
    (schedulerService.scheduleNext as any).mockResolvedValue(undefined);
    (mailService.sendAppointmentReminder as any).mockResolvedValue(undefined);
  });

  it("should search for pending, not-yet-notified appointments due in the next 15 minutes", async () => {
    (appointmentRepository.search as any).mockResolvedValue([]);

    await useCase.execute();

    expect(appointmentRepository.search).toHaveBeenCalledOnce();
    const searchArg = (appointmentRepository.search as any).mock.calls[0][0];
    expect(searchArg).toMatchObject({
      status: "PENDING",
      notified: false,
    });
    expect(searchArg.scheduledBefore).toBeInstanceOf(Date);
  });

  it("should send a reminder mail for each due appointment", async () => {
    const appts = [makeAppointment(), makeAppointment()];
    (appointmentRepository.search as any).mockResolvedValue(appts);

    await useCase.execute();

    expect(mailService.sendAppointmentReminder).toHaveBeenCalledTimes(2);
    expect(mailService.sendAppointmentReminder).toHaveBeenCalledWith(appts[0], fakeEducator.email);
    expect(mailService.sendAppointmentReminder).toHaveBeenCalledWith(appts[1], fakeEducator.email);
  });

  it("should save each appointment as notified after sending mail", async () => {
    const appt = makeAppointment();
    (appointmentRepository.search as any).mockResolvedValue([appt]);

    await useCase.execute();

    expect(appointmentRepository.save).toHaveBeenCalledOnce();
    const savedArg = (appointmentRepository.save as any).mock.calls[0][0];
    expect(savedArg.notifiedAt).toBeInstanceOf(Date);
  });

  it("should call schedulerService.scheduleNext after processing all appointments", async () => {
    const appt = makeAppointment();
    (appointmentRepository.search as any).mockResolvedValue([appt]);

    await useCase.execute();

    expect(schedulerService.scheduleNext).toHaveBeenCalledOnce();
  });

  it("should call scheduleNext even when there are no due appointments", async () => {
    (appointmentRepository.search as any).mockResolvedValue([]);

    await useCase.execute();

    expect(schedulerService.scheduleNext).toHaveBeenCalledOnce();
    expect(mailService.sendAppointmentReminder).not.toHaveBeenCalled();
  });

  it("should continue processing other appointments when mail fails for one", async () => {
    const appt1 = makeAppointment();
    const appt2 = makeAppointment();
    (appointmentRepository.search as any).mockResolvedValue([appt1, appt2]);
    (mailService.sendAppointmentReminder as any)
      .mockRejectedValueOnce(new Error("SMTP error"))
      .mockResolvedValueOnce(undefined);

    await useCase.execute();

    // Both appointments were attempted
    expect(mailService.sendAppointmentReminder).toHaveBeenCalledTimes(2);
  });

  it("should still call scheduleNext even when mail fails for an appointment", async () => {
    const appt = makeAppointment();
    (appointmentRepository.search as any).mockResolvedValue([appt]);
    (mailService.sendAppointmentReminder as any).mockRejectedValue(
      new Error("SMTP error")
    );

    await useCase.execute();

    expect(schedulerService.scheduleNext).toHaveBeenCalledOnce();
  });

  it("should pass a scheduledBefore date approximately 15 minutes ahead of now", async () => {
    (appointmentRepository.search as any).mockResolvedValue([]);

    const before = Date.now();
    await useCase.execute();
    const after = Date.now();

    const searchArg = (appointmentRepository.search as any).mock.calls[0][0];
    const scheduledBefore: Date = searchArg.scheduledBefore;
    const expectedMin = before + 14 * 60 * 1000;
    const expectedMax = after + 16 * 60 * 1000;

    expect(scheduledBefore.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(scheduledBefore.getTime()).toBeLessThanOrEqual(expectedMax);
  });
});
