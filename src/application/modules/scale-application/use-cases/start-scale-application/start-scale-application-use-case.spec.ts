import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { Appointment } from "../../../../../domain/entities/appointment";
import { ApplicationStatus } from "../../../../../domain/entities/scale-application";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { StartScaleApplicationUseCase } from "./start-scale-application-use-case";
import {
  makeApplicationRepository,
  makeDemoTemplate,
  makeStudent,
  makeStudentRepository,
  makeTemplateRepository,
  startApplication,
} from "../test-fixtures";

describe("StartScaleApplicationUseCase", () => {
  const educatorId = Uuid.random();
  const student = makeStudent(educatorId, "Ana");
  const template = makeDemoTemplate();

  let applicationRepository: ReturnType<typeof makeApplicationRepository>;
  let templateRepository: ReturnType<typeof makeTemplateRepository>;
  let studentRepository: ReturnType<typeof makeStudentRepository>;
  let appointmentRepository: AppointmentRepository;
  let useCase: StartScaleApplicationUseCase;

  const request = () => ({
    educatorId,
    studentId: student.id.value,
    templateId: template.id.value,
  });

  beforeEach(() => {
    applicationRepository = makeApplicationRepository();
    templateRepository = makeTemplateRepository([template]);
    studentRepository = makeStudentRepository([student]);
    appointmentRepository = {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as AppointmentRepository;
    useCase = new StartScaleApplicationUseCase(
      applicationRepository,
      templateRepository,
      studentRepository,
      appointmentRepository
    );
  });

  it("should start and save a draft with the template version", async () => {
    const result = await useCase.execute(request());

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { application, template: used, studentName } = result.value;
    expect(application.status).toBe(ApplicationStatus.DRAFT);
    expect(application.templateVersion).toBe(1);
    expect(application.educatorId.value).toBe(educatorId.value);
    expect(used).toBe(template);
    expect(studentName).toBe("Ana");
    expect(applicationRepository.save).toHaveBeenCalledWith(application);
  });

  it("should return STUDENT_NOT_FOUND for a missing student", async () => {
    const result = await useCase.execute({ ...request(), studentId: Uuid.random().value });

    expect(result).toEqual({ ok: false, error: "STUDENT_NOT_FOUND" });
  });

  it("should return UNAUTHORIZED for a student of another educator", async () => {
    const result = await useCase.execute({ ...request(), educatorId: Uuid.random() });

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
    expect(applicationRepository.save).not.toHaveBeenCalled();
  });

  it("should return SCALE_NOT_FOUND for a missing template", async () => {
    const result = await useCase.execute({ ...request(), templateId: Uuid.random().value });

    expect(result).toEqual({ ok: false, error: "SCALE_NOT_FOUND" });
  });

  it("should return SCALE_INACTIVE for an inactive template", async () => {
    const inactive = makeDemoTemplate({ active: false });
    templateRepository.findById.mockResolvedValue(inactive);

    const result = await useCase.execute({ ...request(), templateId: inactive.id.value });

    expect(result).toEqual({ ok: false, error: "SCALE_INACTIVE" });
    expect(applicationRepository.save).not.toHaveBeenCalled();
  });

  it("should return DRAFT_ALREADY_EXISTS with the id of the open draft", async () => {
    const draft = startApplication(template, student);
    applicationRepository.findDraft.mockResolvedValue(draft);

    const result = await useCase.execute(request());

    expect(result).toEqual({
      ok: false,
      error: { code: "DRAFT_ALREADY_EXISTS", applicationId: draft.id.value },
    });
    expect(applicationRepository.findDraft).toHaveBeenCalledWith(student.id, "DEMO-RASTREIO");
    expect(applicationRepository.save).not.toHaveBeenCalled();
  });

  it("should link an appointment of the same educator and student", async () => {
    const appointment = Appointment.create({
      educatorId,
      studentId: student.id,
      scheduledAt: new Date("2026-11-10T13:00:00Z"),
    });
    (appointmentRepository.findById as any).mockResolvedValue(appointment);

    const result = await useCase.execute({ ...request(), appointmentId: appointment.id.value });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.application.appointmentId?.value).toBe(appointment.id.value);
  });

  it("should return INVALID_APPOINTMENT for an appointment of another student or missing", async () => {
    const appointment = Appointment.create({
      educatorId,
      studentId: Uuid.random(),
      scheduledAt: new Date("2026-11-10T13:00:00Z"),
    });
    (appointmentRepository.findById as any).mockResolvedValue(appointment);

    expect(
      await useCase.execute({ ...request(), appointmentId: appointment.id.value })
    ).toEqual({ ok: false, error: "INVALID_APPOINTMENT" });

    (appointmentRepository.findById as any).mockResolvedValue(null);
    expect(
      await useCase.execute({ ...request(), appointmentId: Uuid.random().value })
    ).toEqual({ ok: false, error: "INVALID_APPOINTMENT" });
    expect(applicationRepository.save).not.toHaveBeenCalled();
  });
});
