// O atendimento segue o acesso ao aluno, inclusive o criado pelo próprio
// educador: quem perde o acesso não lê, edita nem exclui, e o atendimento
// some da agenda dele.
import { describe, expect, it, vi } from "vitest";
import { failure, Uuid } from "@wave-telecom/framework/core";
import { Appointment } from "../../../../domain/entities/appointment";
import {
  AppointmentRepository,
  SearchAppointmentParams,
} from "../../../../domain/repositories/appointment-repository";
import { AppointmentSchedulerService } from "../../../../domain/services/appointment-scheduler-service";
import {
  makeShareRepository,
  makeStudentAccess,
  makeStudentRepositoryFake,
  shareStudent,
} from "../../../../domain/tests/fakes/student-share-fakes";
import { makeStudent } from "../../session-evolution/use-cases/test-fixtures";
import { CreateAppointmentUseCase } from "./create-appointment/create-appointment-use-case";
import { DeleteAppointmentUseCase } from "./delete-appointment/delete-appointment-use-case";
import { GetAppointmentUseCase } from "./get-appointment/get-appointment-use-case";
import { ListAppointmentsUseCase } from "./list-appointments/list-appointments-use-case";
import { UpdateAppointmentUseCase } from "./update-appointment/update-appointment-use-case";

const setup = () => {
  const ownerId = Uuid.random();
  const colleagueId = Uuid.random();
  const shared = makeStudent(ownerId, "Ana");
  const own = makeStudent(colleagueId, "Bia");

  const store = new Map<string, Appointment>();
  const appointmentRepository = {
    save: vi.fn(async (appointment: Appointment) => {
      store.set(appointment.id.value, appointment);
    }),
    findById: vi.fn(async (id: Uuid) => store.get(id.value) ?? null),
    search: vi.fn(async (params: SearchAppointmentParams) =>
      [...store.values()].filter(
        (a) =>
          (!params.educatorId || a.educatorId.value === params.educatorId.value) &&
          (!params.studentId || a.studentId.value === params.studentId.value) &&
          (!params.status || a.status === params.status)
      )
    ),
    delete: vi.fn(async (id: Uuid) => {
      store.delete(id.value);
    }),
  } satisfies AppointmentRepository;
  const scheduler = {
    ensureScheduled: vi.fn(async () => undefined),
    cancel: vi.fn(async () => undefined),
    scheduleNext: vi.fn(async () => undefined),
  } as unknown as AppointmentSchedulerService;

  const shareRepository = makeShareRepository([shareStudent(shared, colleagueId)]);
  const access = makeStudentAccess(makeStudentRepositoryFake([shared, own]), shareRepository);

  return {
    ownerId,
    colleagueId,
    shared,
    own,
    shareRepository,
    appointmentRepository,
    create: new CreateAppointmentUseCase(appointmentRepository, scheduler, access),
    get: new GetAppointmentUseCase(appointmentRepository, access),
    update: new UpdateAppointmentUseCase(appointmentRepository, scheduler, access),
    remove: new DeleteAppointmentUseCase(appointmentRepository, scheduler, access),
    list: new ListAppointmentsUseCase(appointmentRepository, access),
  };
};

describe("Atendimento e acesso ao aluno", () => {
  it("depois de desfazer o compartilhamento, quem criou o atendimento recebe 404 e ele some da agenda", async () => {
    const ctx = setup();
    const created = await ctx.create.execute({
      educatorId: ctx.colleagueId,
      studentId: ctx.shared.id.value,
      scheduledAt: new Date("2030-01-10T13:00:00Z"),
    });
    expect(created.ok).toBe(true);
    const appointment = (created as any).value as Appointment;
    const ownCreated = await ctx.create.execute({
      educatorId: ctx.colleagueId,
      studentId: ctx.own.id.value,
      scheduledAt: new Date("2030-01-11T13:00:00Z"),
    });
    const ownAppointment = (ownCreated as any).value as Appointment;

    const before = await ctx.list.execute({ educatorId: ctx.colleagueId });
    expect((before as any).value.map((a: any) => a.id).sort()).toEqual(
      [appointment.id.value, ownAppointment.id.value].sort()
    );

    await ctx.shareRepository.delete(ctx.shared.id, ctx.colleagueId);

    const request = { id: appointment.id, educatorId: ctx.colleagueId };
    expect(await ctx.get.execute(request)).toEqual(failure("NOT_FOUND"));
    expect(await ctx.update.execute({ ...request, observation: "Nota" })).toEqual(
      failure("NOT_FOUND")
    );
    expect(await ctx.remove.execute(request)).toEqual(failure("NOT_FOUND"));
    expect(ctx.appointmentRepository.delete).not.toHaveBeenCalled();

    const after = await ctx.list.execute({ educatorId: ctx.colleagueId });
    expect((after as any).value.map((a: any) => a.id)).toEqual([ownAppointment.id.value]);

    // O dono do aluno continua vendo o atendimento pela lista do aluno.
    const byOwner = await ctx.list.execute({
      educatorId: ctx.ownerId,
      studentId: ctx.shared.id,
    });
    expect((byOwner as any).value.map((a: any) => a.id)).toEqual([appointment.id.value]);
  });
});
