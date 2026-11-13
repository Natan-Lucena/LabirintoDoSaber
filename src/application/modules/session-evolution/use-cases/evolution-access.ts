import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { Plan } from "../../../../domain/entities/plan";
import {
  computeGoalChanges,
  EvolutionGoalUpdate,
} from "../../../../domain/entities/session-evolution";
import { SessionEvolutionRepository } from "../../../../domain/repositories/session-evolution-repository";
import { StudentRepository } from "../../../../domain/repositories/student-repository";
import { TaskNotebookSessionRepository } from "../../../../domain/repositories/task-notebook-session-repository";
import { assertStudentOwnership } from "../../plan/use-cases/plan-access";

// O acesso é pelo dono atual do aluno (EV-01), não pelo educatorId gravado na
// sessão ou na evolução.
export async function loadOwnedSession(
  sessionRepository: TaskNotebookSessionRepository,
  studentRepository: StudentRepository,
  sessionId: string,
  educatorId: Uuid
) {
  if (!Uuid.isValid(sessionId)) return failure("SESSION_NOT_FOUND");

  const session = await sessionRepository.getById(new Uuid(sessionId));
  if (!session) return failure("SESSION_NOT_FOUND");

  const ownership = await assertStudentOwnership(
    studentRepository,
    session.studentId,
    educatorId
  );
  if (!ownership.ok) return ownership;

  return success({ session, student: ownership.value });
}

export async function loadOwnedEvolution(
  evolutionRepository: SessionEvolutionRepository,
  studentRepository: StudentRepository,
  evolutionId: string,
  educatorId: Uuid
) {
  if (!Uuid.isValid(evolutionId)) return failure("EVOLUTION_NOT_FOUND");

  const evolution = await evolutionRepository.findById(new Uuid(evolutionId));
  if (!evolution) return failure("EVOLUTION_NOT_FOUND");

  const ownership = await assertStudentOwnership(
    studentRepository,
    evolution.studentId,
    educatorId
  );
  if (!ownership.ok) return ownership;

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
