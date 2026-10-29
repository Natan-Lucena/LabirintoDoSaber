import { describe, it, expect, vi, beforeEach } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { CreatePlanUseCase, CreatePlanUseCaseRequest } from "./create-plan-use-case";
import { Plan, PlanSource, PlanStatus, PlanType } from "../../../../../domain/entities/plan";
import { Gender, Student } from "../../../../../domain/entities/student";
import { Appointment } from "../../../../../domain/entities/appointment";
import { PlanRepository } from "../../../../../domain/repositories/plan-repository";
import { StudentRepository } from "../../../../../domain/repositories/student-repository";
import { AppointmentRepository } from "../../../../../domain/repositories/appointment-repository";
import { createPlanSchema } from "../../schemas/create-plan.schema";

const makeStudent = (educatorId: Uuid) =>
  Student.create({
    name: "Ana",
    age: 8,
    gender: Gender.Female,
    zipcode: "00000000",
    road: "Rua",
    housenumber: "1",
    phonenumber: "11999999999",
    learningTopics: [],
    educators: [],
    educatorId,
  });

const makePlan = (educatorId: Uuid, studentId: Uuid, type: PlanType) => {
  const result =
    type === PlanType.PDI
      ? Plan.create({
          educatorId,
          studentId,
          type,
          source: PlanSource.MANUAL,
          title: "PDI",
          generalObjective: "Objetivo",
          startDate: "2026-01-01",
          endDate: "2026-06-30",
          goals: [{ description: "Meta" }],
        })
      : Plan.create({
          educatorId,
          studentId,
          type,
          source: PlanSource.MANUAL,
          title: "PE",
          generalObjective: "Objetivo",
          sessionDate: "2026-02-10",
          goals: [{ description: "Meta" }],
        });
  if (!result.ok) throw new Error(result.error);
  return result.value;
};

describe("CreatePlanUseCase", () => {
  let planRepository: PlanRepository;
  let studentRepository: StudentRepository;
  let appointmentRepository: AppointmentRepository;
  let useCase: CreatePlanUseCase;

  const educatorId = Uuid.random();
  const student = makeStudent(educatorId);

  const pdiRequest: CreatePlanUseCaseRequest = {
    educatorId,
    studentId: student.id.value,
    type: PlanType.PDI,
    source: PlanSource.MANUAL,
    title: "Plano do semestre",
    generalObjective: "Desenvolver leitura",
    startDate: "2026-01-01",
    endDate: "2026-06-30",
    goals: [{ description: "Ler palavras simples" }],
  };

  const peRequest: CreatePlanUseCaseRequest = {
    educatorId,
    studentId: student.id.value,
    type: PlanType.PE,
    source: PlanSource.MANUAL,
    title: "Sessão",
    generalObjective: "Trabalhar sílabas",
    sessionDate: "2026-02-10",
    goals: [{ description: "Separar sílabas" }],
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    planRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      search: vi.fn(),
      findActivePdi: vi.fn().mockResolvedValue(null),
    } as unknown as PlanRepository;
    studentRepository = {
      getById: vi.fn().mockResolvedValue(student),
      getByIds: vi.fn(),
    } as unknown as StudentRepository;
    appointmentRepository = {
      findById: vi.fn().mockResolvedValue(null),
    } as unknown as AppointmentRepository;
    useCase = new CreatePlanUseCase(planRepository, studentRepository, appointmentRepository);
  });

  it("should create and save an active PDI", async () => {
    const result = await useCase.execute(pdiRequest);

    expect(result.ok).toBe(true);
    const plan = (result as any).value as Plan;
    expect(plan.type).toBe(PlanType.PDI);
    expect(plan.status).toBe(PlanStatus.ACTIVE);
    expect(plan.educatorId.value).toBe(educatorId.value);
    expect(planRepository.save).toHaveBeenCalledWith(plan);
  });

  it("should return ACTIVE_PDI_ALREADY_EXISTS with the active plan id", async () => {
    const activePdi = makePlan(educatorId, student.id, PlanType.PDI);
    (planRepository.findActivePdi as any).mockResolvedValue(activePdi);

    const result = await useCase.execute(pdiRequest);

    expect(result).toEqual({
      ok: false,
      error: { code: "ACTIVE_PDI_ALREADY_EXISTS", activePlanId: activePdi.id.value },
    });
    expect(planRepository.save).not.toHaveBeenCalled();
  });

  it("should return UNAUTHORIZED when the student belongs to another educator", async () => {
    (studentRepository.getById as any).mockResolvedValue(makeStudent(Uuid.random()));

    const result = await useCase.execute(pdiRequest);

    expect(result).toEqual({ ok: false, error: "UNAUTHORIZED" });
  });

  it("should return STUDENT_NOT_FOUND when the student does not exist", async () => {
    (studentRepository.getById as any).mockResolvedValue(null);

    const result = await useCase.execute(pdiRequest);

    expect(result).toEqual({ ok: false, error: "STUDENT_NOT_FOUND" });
  });

  it("should return INVALID_DATES when a PDI comes without dates", async () => {
    const result = await useCase.execute({
      ...pdiRequest,
      startDate: undefined,
      endDate: undefined,
    });

    expect(result).toEqual({ ok: false, error: "INVALID_DATES" });
  });

  it("should create a PE linked to a PDI of the same student", async () => {
    const parent = makePlan(educatorId, student.id, PlanType.PDI);
    (planRepository.findById as any).mockResolvedValue(parent);

    const result = await useCase.execute({ ...peRequest, parentPlanId: parent.id.value });

    expect(result.ok).toBe(true);
    expect(((result as any).value as Plan).parentPlanId?.value).toBe(parent.id.value);
  });

  it("should return INVALID_PARENT_PLAN when the parent is not a PDI", async () => {
    const parent = makePlan(educatorId, student.id, PlanType.PE);
    (planRepository.findById as any).mockResolvedValue(parent);

    const result = await useCase.execute({ ...peRequest, parentPlanId: parent.id.value });

    expect(result).toEqual({ ok: false, error: "INVALID_PARENT_PLAN" });
  });

  it("should return INVALID_PARENT_PLAN when the parent belongs to another student", async () => {
    const parent = makePlan(educatorId, Uuid.random(), PlanType.PDI);
    (planRepository.findById as any).mockResolvedValue(parent);

    const result = await useCase.execute({ ...peRequest, parentPlanId: parent.id.value });

    expect(result).toEqual({ ok: false, error: "INVALID_PARENT_PLAN" });
  });

  it("should return INVALID_PARENT_PLAN when the parent does not exist", async () => {
    const result = await useCase.execute({ ...peRequest, parentPlanId: Uuid.random().value });

    expect(result).toEqual({ ok: false, error: "INVALID_PARENT_PLAN" });
  });

  it("should return INVALID_APPOINTMENT when the appointment is of another student", async () => {
    const appointment = Appointment.create({
      educatorId,
      studentId: Uuid.random(),
      scheduledAt: new Date("2026-02-10T13:00:00Z"),
    });
    (appointmentRepository.findById as any).mockResolvedValue(appointment);

    const result = await useCase.execute({ ...peRequest, appointmentId: appointment.id.value });

    expect(result).toEqual({ ok: false, error: "INVALID_APPOINTMENT" });
    expect(planRepository.save).not.toHaveBeenCalled();
  });

  it("should accept an appointment of the same educator and student", async () => {
    const appointment = Appointment.create({
      educatorId,
      studentId: student.id,
      scheduledAt: new Date("2026-02-10T13:00:00Z"),
    });
    (appointmentRepository.findById as any).mockResolvedValue(appointment);

    const result = await useCase.execute({ ...peRequest, appointmentId: appointment.id.value });

    expect(result.ok).toBe(true);
    const plan = (result as any).value as Plan;
    expect(plan.appointmentId?.value).toBe(appointment.id.value);
    expect(plan.startDate).toBe("2026-02-10");
    expect(plan.endDate).toBe("2026-02-10");
    expect(planRepository.save).toHaveBeenCalledWith(plan);
  });

  it("should return INVALID_APPOINTMENT when the appointment does not exist", async () => {
    const result = await useCase.execute({ ...peRequest, appointmentId: Uuid.random().value });

    expect(result).toEqual({ ok: false, error: "INVALID_APPOINTMENT" });
    expect(planRepository.save).not.toHaveBeenCalled();
  });

  it("should return INVALID_APPOINTMENT when the appointment is of another educator", async () => {
    const appointment = Appointment.create({
      educatorId: Uuid.random(),
      studentId: student.id,
      scheduledAt: new Date("2026-02-10T13:00:00Z"),
    });
    (appointmentRepository.findById as any).mockResolvedValue(appointment);

    const result = await useCase.execute({ ...peRequest, appointmentId: appointment.id.value });

    expect(result).toEqual({ ok: false, error: "INVALID_APPOINTMENT" });
    expect(planRepository.save).not.toHaveBeenCalled();
  });
});

describe("createPlanSchema", () => {
  const body = {
    studentId: Uuid.random().value,
    type: "PDI",
    source: "MANUAL",
    title: "Plano",
    generalObjective: "Objetivo",
    startDate: "2026-01-01",
    endDate: "2026-06-30",
    goals: [{ description: "Meta" }],
  };

  it("should accept a valid body", () => {
    expect(createPlanSchema.safeParse(body).success).toBe(true);
  });

  it.each(["studentId", "parentPlanId", "appointmentId"])(
    "should reject a non-RFC uuid in %s",
    (field) => {
      const result = createPlanSchema.safeParse({
        ...body,
        [field]: "11111111-1111-1111-1111-111111111111",
      });

      expect(result.success).toBe(false);
    }
  );
});
