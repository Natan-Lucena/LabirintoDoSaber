import { Uuid } from "@wave-telecom/framework/core";
import { Appointment } from "../entities/appointment";
import { Plan, PlanType } from "../entities/plan";
import { ScaleApplication } from "../entities/scale-application";
import { addDays } from "../utils/date-only";

// Regras de pendência compartilhadas com o cron de notificações (PA-07).
// Evolução pendente: sessão finalizada há até 30 dias sem evolução (a mesma
// janela padrão de GET /session-evolution/pending).
export const EVOLUTION_PENDING_WINDOW_DAYS = 30;
// Revisão de plano: plano ACTIVE com nextReviewDate até hoje + 2 dias,
// inclusive as vencidas.
export const PLAN_REVIEW_DAYS_AHEAD = 2;

export type PatientPrimaryStatus = "PDI_ACTIVE" | "ASSESSMENT_PENDING" | "PLAN_REVIEW" | "NO_PLAN";

export type PatientPendingKind =
  | "EVOLUTION_PENDING"
  | "PLAN_REVIEW_DUE"
  | "SCALE_DRAFT"
  | "ANAMNESIS_MISSING";

export interface PatientPending {
  kind: PatientPendingKind;
  count: number;
  // Só quando há um único alvo.
  targetId?: string;
}

export interface PatientOverview {
  studentId: string;
  primaryStatus: PatientPrimaryStatus;
  activePlan?: { id: string; type: PlanType; title: string; percent: number };
  nextAppointment?: { id: string; scheduledAt: string };
  pendings: PatientPending[];
}

export interface PatientOverviewInput {
  studentId: Uuid;
  // AAAA-MM-DD em America/Sao_Paulo.
  today: string;
  // Planos ACTIVE do aluno.
  activePlans: Plan[];
  // Atendimentos PENDING futuros do aluno.
  futureAppointments: Appointment[];
  // Sessões finalizadas na janela, sem evolução.
  pendingEvolutionSessionIds: Uuid[];
  // Aplicações de escala em DRAFT do aluno.
  scaleDrafts: ScaleApplication[];
  hasAnamnesis: boolean;
}

// Visão do paciente calculada na leitura (PA-06, PA-07), sem consulta: quem
// chama carrega os dados de todos os alunos em lote.
export function buildPatientOverview(input: PatientOverviewInput): PatientOverview {
  const reviewDueBy = addDays(input.today, PLAN_REVIEW_DAYS_AHEAD);
  const reviewDue = input.activePlans.filter(
    (plan) => plan.nextReviewDate !== undefined && plan.nextReviewDate <= reviewDueBy
  );
  // "Revisão vencida": a data de revisão já chegou.
  const reviewOverdue = reviewDue.some((plan) => plan.nextReviewDate! <= input.today);

  const activePdi = input.activePlans.find((plan) => plan.type === PlanType.PDI);
  const latestPe = input.activePlans
    .filter((plan) => plan.type === PlanType.PE)
    .sort(
      (a, b) =>
        (b.sessionDate ?? "").localeCompare(a.sessionDate ?? "") ||
        b.createdAt.getTime() - a.createdAt.getTime()
    )[0];
  const plan = activePdi ?? latestPe;

  const next = [...input.futureAppointments].sort(
    (a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime()
  )[0];

  // PA-06, nesta ordem.
  let primaryStatus: PatientPrimaryStatus = "NO_PLAN";
  if (reviewOverdue) primaryStatus = "PLAN_REVIEW";
  else if (input.scaleDrafts.length > 0 || !input.hasAnamnesis) primaryStatus = "ASSESSMENT_PENDING";
  else if (activePdi) primaryStatus = "PDI_ACTIVE";

  const pendings: PatientPending[] = [
    pending("EVOLUTION_PENDING", input.pendingEvolutionSessionIds.map((id) => id.value)),
    pending("PLAN_REVIEW_DUE", reviewDue.map((p) => p.id.value)),
    pending("SCALE_DRAFT", input.scaleDrafts.map((a) => a.id.value)),
  ].filter((item): item is PatientPending => item !== undefined);
  if (!input.hasAnamnesis) pendings.push({ kind: "ANAMNESIS_MISSING", count: 1 });

  return {
    studentId: input.studentId.value,
    primaryStatus,
    ...(plan
      ? {
          activePlan: {
            id: plan.id.value,
            type: plan.type,
            title: plan.title,
            percent: plan.progress.percent,
          },
        }
      : {}),
    ...(next
      ? { nextAppointment: { id: next.id.value, scheduledAt: next.scheduledAt.toISOString() } }
      : {}),
    pendings,
  };
}

function pending(kind: PatientPendingKind, targetIds: string[]): PatientPending | undefined {
  if (targetIds.length === 0) return undefined;
  return targetIds.length === 1
    ? { kind, count: 1, targetId: targetIds[0] }
    : { kind, count: targetIds.length };
}
