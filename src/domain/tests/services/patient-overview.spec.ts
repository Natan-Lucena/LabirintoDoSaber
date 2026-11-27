import { describe, expect, it } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { Appointment } from "../../entities/appointment";
import { GoalStatus, Plan, PlanSource, PlanType } from "../../entities/plan";
import { ApplicationStatus, ScaleApplication } from "../../entities/scale-application";
import { buildPatientOverview, PatientOverviewInput } from "../../services/patient-overview";

const TODAY = "2026-11-26";
const studentId = Uuid.random();
const educatorId = Uuid.random();

const pdi = (nextReviewDate?: string) => {
  const created = Plan.create({
    educatorId,
    studentId,
    type: PlanType.PDI,
    source: PlanSource.MANUAL,
    title: "PDI de leitura",
    generalObjective: "Ler",
    startDate: "2026-10-01",
    endDate: "2027-03-01",
    nextReviewDate,
    goals: [{ description: "Meta 1" }, { description: "Meta 2" }],
  });
  if (!created.ok) throw new Error(String(created.error));
  return created.value;
};

const pe = (sessionDate: string, title = "PE da sessão") => {
  const created = Plan.create({
    educatorId,
    studentId,
    type: PlanType.PE,
    source: PlanSource.MANUAL,
    title,
    generalObjective: "Sessão",
    sessionDate,
    goals: [{ description: "Meta" }],
  });
  if (!created.ok) throw new Error(String(created.error));
  return created.value;
};

const draft = () =>
  ScaleApplication.fromPersistence({
    id: Uuid.random(),
    templateId: Uuid.random(),
    templateCode: "SNAP-IV",
    templateVersion: 1,
    templateName: "SNAP-IV",
    studentId,
    educatorId,
    status: ApplicationStatus.DRAFT,
    answers: [],
    startedAt: new Date(),
    updatedAt: new Date(),
  });

const appointment = (scheduledAt: string) =>
  Appointment.create({ educatorId, studentId, scheduledAt: new Date(scheduledAt) });

const input = (overrides: Partial<PatientOverviewInput> = {}): PatientOverviewInput => ({
  studentId,
  today: TODAY,
  activePlans: [],
  futureAppointments: [],
  pendingEvolutionSessionIds: [],
  scaleDrafts: [],
  hasAnamnesis: true,
  ...overrides,
});

describe("buildPatientOverview", () => {
  describe("primaryStatus (PA-06)", () => {
    it("sem plano, com anamnese e sem rascunho: NO_PLAN", () => {
      expect(buildPatientOverview(input()).primaryStatus).toBe("NO_PLAN");
    });

    it("PDI ativo: PDI_ACTIVE", () => {
      expect(buildPatientOverview(input({ activePlans: [pdi()] })).primaryStatus).toBe(
        "PDI_ACTIVE"
      );
    });

    it("só PE ativo não é PDI_ACTIVE: NO_PLAN", () => {
      expect(
        buildPatientOverview(input({ activePlans: [pe("2026-11-20")] })).primaryStatus
      ).toBe("NO_PLAN");
    });

    it("sem anamnese: ASSESSMENT_PENDING, acima do PDI ativo", () => {
      expect(
        buildPatientOverview(input({ hasAnamnesis: false, activePlans: [pdi()] })).primaryStatus
      ).toBe("ASSESSMENT_PENDING");
    });

    it("rascunho de escala: ASSESSMENT_PENDING, acima do PDI ativo", () => {
      expect(
        buildPatientOverview(input({ scaleDrafts: [draft()], activePlans: [pdi()] }))
          .primaryStatus
      ).toBe("ASSESSMENT_PENDING");
    });

    it("revisão vencida: PLAN_REVIEW, acima de tudo", () => {
      expect(
        buildPatientOverview(
          input({ activePlans: [pdi("2026-11-20")], hasAnamnesis: false, scaleDrafts: [draft()] })
        ).primaryStatus
      ).toBe("PLAN_REVIEW");
    });

    it("revisão no próprio dia já conta como vencida", () => {
      expect(
        buildPatientOverview(input({ activePlans: [pdi(TODAY)] })).primaryStatus
      ).toBe("PLAN_REVIEW");
    });

    it("revisão daqui a 2 dias ainda não é PLAN_REVIEW, mas é pendência", () => {
      const overview = buildPatientOverview(input({ activePlans: [pdi("2026-11-28")] }));

      expect(overview.primaryStatus).toBe("PDI_ACTIVE");
      expect(overview.pendings).toContainEqual(
        expect.objectContaining({ kind: "PLAN_REVIEW_DUE", count: 1 })
      );
    });
  });

  describe("activePlan", () => {
    it("prefere o PDI ativo, com o percent do progresso", () => {
      const plan = pdi();
      const progressed = plan.changeGoalStatus(plan.goals[0].id.value, GoalStatus.ACHIEVED);
      if (!progressed.ok) throw new Error("goal");

      const overview = buildPatientOverview(
        input({ activePlans: [pe("2026-11-25"), progressed.value] })
      );

      expect(overview.activePlan).toEqual({
        id: plan.id.value,
        type: "PDI",
        title: "PDI de leitura",
        percent: 50,
      });
    });

    it("sem PDI, o PE ativo mais recente", () => {
      const older = pe("2026-11-10", "Antigo");
      const newer = pe("2026-11-24", "Recente");

      const overview = buildPatientOverview(input({ activePlans: [older, newer] }));

      expect(overview.activePlan).toEqual({
        id: newer.id.value,
        type: "PE",
        title: "Recente",
        percent: 0,
      });
    });

    it("sem plano ativo: ausente", () => {
      expect(buildPatientOverview(input())).not.toHaveProperty("activePlan");
    });
  });

  describe("nextAppointment", () => {
    it("o mais próximo entre os futuros", () => {
      const later = appointment("2026-12-10T13:00:00.000Z");
      const sooner = appointment("2026-11-27T13:00:00.000Z");

      expect(
        buildPatientOverview(input({ futureAppointments: [later, sooner] })).nextAppointment
      ).toEqual({ id: sooner.id.value, scheduledAt: "2026-11-27T13:00:00.000Z" });
    });

    it("sem atendimento futuro: ausente", () => {
      expect(buildPatientOverview(input())).not.toHaveProperty("nextAppointment");
    });
  });

  describe("pendings (PA-07)", () => {
    it("sem pendência: lista vazia", () => {
      expect(buildPatientOverview(input({ activePlans: [pdi()] })).pendings).toEqual([]);
    });

    it("um alvo só leva targetId", () => {
      const sessionId = Uuid.random();
      const plan = pdi("2026-11-27");
      const application = draft();

      const overview = buildPatientOverview(
        input({
          pendingEvolutionSessionIds: [sessionId],
          activePlans: [plan],
          scaleDrafts: [application],
          hasAnamnesis: false,
        })
      );

      expect(overview.pendings).toEqual([
        { kind: "EVOLUTION_PENDING", count: 1, targetId: sessionId.value },
        { kind: "PLAN_REVIEW_DUE", count: 1, targetId: plan.id.value },
        { kind: "SCALE_DRAFT", count: 1, targetId: application.id.value },
        { kind: "ANAMNESIS_MISSING", count: 1 },
      ]);
    });

    it("vários alvos: só a contagem", () => {
      const overview = buildPatientOverview(
        input({
          pendingEvolutionSessionIds: [Uuid.random(), Uuid.random()],
          activePlans: [pdi("2026-11-20"), pdi("2026-11-27")],
          scaleDrafts: [draft(), draft()],
        })
      );

      expect(overview.pendings).toEqual([
        { kind: "EVOLUTION_PENDING", count: 2 },
        { kind: "PLAN_REVIEW_DUE", count: 2 },
        { kind: "SCALE_DRAFT", count: 2 },
      ]);
    });

    it("PLAN_REVIEW_DUE: revisão até hoje+2, inclusive as vencidas; depois disso não", () => {
      const inThreeDays = pdi("2026-11-29");
      expect(buildPatientOverview(input({ activePlans: [inThreeDays] })).pendings).toEqual([]);

      const overdue = pdi("2026-11-01");
      const inTwoDays = pdi("2026-11-28");
      expect(
        buildPatientOverview(input({ activePlans: [overdue, inTwoDays, inThreeDays] })).pendings
      ).toEqual([{ kind: "PLAN_REVIEW_DUE", count: 2 }]);
    });
  });
});
