import { GoalStatus, Plan, PlanStatus, PlanType } from "../entities/plan";
import { TaskNotebookSession } from "../entities/task-notebook-session";
import { dateInSaoPaulo } from "../utils/date-only";

export interface SuggestedCriterion {
  goalId: string;
  description: string;
  successCriterion?: string;
  goalStatus: GoalStatus;
}

export interface EvolutionPlanSelection {
  plan: Plan;
  suggestedCriteria: SuggestedCriterion[];
}

export interface SelectEvolutionPlanParams {
  session: TaskNotebookSession;
  plans: Plan[];
}

const CLOSED_GOAL_STATUSES = [GoalStatus.ACHIEVED, GoalStatus.DISCONTINUED];

// EV-12: 1) PE do atendimento da sessão; 2) PE da data da sessão; 3) PDI ativo.
export function selectEvolutionPlan({
  session,
  plans,
}: SelectEvolutionPlanParams): EvolutionPlanSelection | undefined {
  const active = plans.filter((plan) => plan.status === PlanStatus.ACTIVE);
  const pes = active.filter((plan) => plan.type === PlanType.PE);
  const sessionDate = dateInSaoPaulo(session.startedAt);
  const appointmentId = session.appointmentId?.value;

  const plan =
    (appointmentId
      ? pes.find((pe) => pe.appointmentId?.value === appointmentId)
      : undefined) ??
    pes.find((pe) => pe.sessionDate === sessionDate) ??
    active.find((candidate) => candidate.type === PlanType.PDI);

  if (!plan) return undefined;

  const suggestedCriteria = [...plan.goals]
    .filter((goal) => !CLOSED_GOAL_STATUSES.includes(goal.status))
    .sort((a, b) => a.order - b.order)
    .map((goal) => ({
      goalId: goal.id.value,
      description: goal.description,
      successCriterion: goal.successCriterion,
      goalStatus: goal.status,
    }));

  return { plan, suggestedCriteria };
}
