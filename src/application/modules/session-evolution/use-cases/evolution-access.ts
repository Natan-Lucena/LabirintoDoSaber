import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { Plan } from "../../../../domain/entities/plan";
import {
  computeGoalChanges,
  EvolutionGoalUpdate,
} from "../../../../domain/entities/session-evolution";
import { SessionEvolutionRepository } from "../../../../domain/repositories/session-evolution-repository";
import { TaskNotebookSessionRepository } from "../../../../domain/repositories/task-notebook-session-repository";
import { StudentAccessService } from "../../../../domain/services/student-access-service";

// O acesso é pelo aluno, dono atual ou compartilhado (EV-01, EQ-11), não pelo
// educatorId gravado na sessão ou na evolução.
export async function loadAccessibleSession(
  sessionRepository: TaskNotebookSessionRepository,
  studentAccess: StudentAccessService,
  sessionId: string,
  educatorId: Uuid
) {
  if (!Uuid.isValid(sessionId)) return failure("SESSION_NOT_FOUND");

  const session = await sessionRepository.getById(new Uuid(sessionId));
  if (!session) return failure("SESSION_NOT_FOUND");

  const access = await studentAccess.assertStudentAccess(session.studentId, educatorId);
  if (!access.ok) return access;

  return success({ session, student: access.value });
}

export async function loadAccessibleEvolution(
  evolutionRepository: SessionEvolutionRepository,
  studentAccess: StudentAccessService,
  evolutionId: string,
  educatorId: Uuid
) {
  if (!Uuid.isValid(evolutionId)) return failure("EVOLUTION_NOT_FOUND");

  const evolution = await evolutionRepository.findById(new Uuid(evolutionId));
  if (!evolution) return failure("EVOLUTION_NOT_FOUND");

  const access = await studentAccess.assertStudentAccess(evolution.studentId, educatorId);
  if (!access.ok) return access;

  return success(evolution);
}

// Aplica em memória só as metas que mudam (EV-07, EV-09). Devolve o plano
// alterado, ou undefined quando não há nada para gravar.
export function applyGoalChanges(plan: Plan, goalUpdates: EvolutionGoalUpdate[]) {
  const changes = computeGoalChanges(plan, goalUpdates);
  if (changes.length === 0) return success(undefined);

  let updated = plan;
  for (const change of changes) {
    const result = updated.changeGoalStatus(change.goalId, change.status);
    if (!result.ok) return result;
    updated = result.value;
  }

  return success(updated);
}
