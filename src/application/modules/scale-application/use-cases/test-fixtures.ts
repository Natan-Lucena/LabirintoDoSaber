// Repositórios simulados e entidades reais para os specs de aplicação de escala.
import { vi } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import {
  ScaleApplication,
  ScaleInsight,
} from "../../../../domain/entities/scale-application";
import { ScaleTemplate } from "../../../../domain/entities/scale-template";
import { ScaleApplicationRepository } from "../../../../domain/repositories/scale-application-repository";
import { ScaleTemplateRepository } from "../../../../domain/repositories/scale-template-repository";
import { StudentRepository } from "../../../../domain/repositories/student-repository";
import { Student } from "../../../../domain/entities/student";

export { makeStudent } from "../../session-evolution/use-cases/test-fixtures";
export {
  demoAnswers,
  makeDemoTemplate,
} from "../../../../domain/tests/entities/scale-fixtures";

export const unwrap = <T>(result: { ok: boolean; value?: T; error?: unknown }): T => {
  if (!result.ok) throw new Error(`unexpected ${JSON.stringify(result.error)}`);
  return result.value as T;
};

export const startApplication = (template: ScaleTemplate, student: Student) =>
  unwrap<ScaleApplication>(
    ScaleApplication.start({
      template,
      studentId: student.id,
      educatorId: student.educatorId,
    })
  );

// "Banco" em memória atrás de vi.fn(), para encadear use cases num mesmo spec.
export const makeApplicationRepository = (initial: ScaleApplication[] = []) => {
  const store = new Map(initial.map((application) => [application.id.value, application]));
  return {
    store,
    save: vi.fn(async (application: ScaleApplication) => {
      store.set(application.id.value, application);
    }),
    saveInsight: vi.fn(async (id: Uuid, insight: ScaleInsight) => {
      const current = store.get(id.value);
      if (!current) return false;
      store.set(id.value, current.withInsight(insight));
      return true;
    }),
    findById: vi.fn(async (id: Uuid) => store.get(id.value) ?? null),
    findDraft: vi.fn().mockResolvedValue(null),
    search: vi.fn(async () => [...store.values()]),
    delete: vi.fn(async (id: Uuid) => {
      store.delete(id.value);
    }),
    listDraftsUpdatedBefore: vi.fn(),
  } satisfies ScaleApplicationRepository & { store: Map<string, ScaleApplication> };
};

export const makeTemplateRepository = (templates: ScaleTemplate[]) =>
  ({
    save: vi.fn(),
    findById: vi.fn(
      async (id: Uuid) => templates.find((template) => template.id.value === id.value) ?? null
    ),
    findByIds: vi.fn(async (ids: Uuid[]) =>
      templates.filter((template) => ids.some((id) => id.value === template.id.value))
    ),
    findByCodeAndVersion: vi.fn(),
    findLatestByCode: vi.fn(async (code: string) =>
      templates
        .filter((template) => template.code === code)
        .reduce<ScaleTemplate | null>(
          (latest, template) =>
            !latest || template.version > latest.version ? template : latest,
          null
        )
    ),
    listCatalog: vi.fn().mockResolvedValue(templates),
  }) satisfies ScaleTemplateRepository;

export const makeStudentRepository = (students: Student[]) =>
  ({
    save: vi.fn(),
    getById: vi.fn(
      async (id: Uuid) => students.find((student) => student.id.value === id.value) ?? null
    ),
    getByIds: vi.fn(),
    search: vi.fn(async ({ educatorId }: { educatorId?: Uuid }) =>
      students.filter((student) => student.educatorId.value === educatorId?.value)
    ),
    delete: vi.fn(),
  }) satisfies StudentRepository;
