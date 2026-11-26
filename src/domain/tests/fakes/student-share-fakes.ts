// Compartilhamentos em memória para os specs. Respeitam o par único
// (studentId, educatorId), como o repositório Prisma.
import { vi } from "vitest";
import { Uuid } from "@wave-telecom/framework/core";
import { Student } from "../../entities/student";
import { StudentShare } from "../../entities/student-share";
import { StudentRepository } from "../../repositories/student-repository";
import { StudentShareRepository } from "../../repositories/student-share-repository";
import { StudentAccessService } from "../../services/student-access-service";

export const shareStudent = (student: Student, educatorId: Uuid, now?: Date) =>
  StudentShare.create({
    studentId: student.id,
    educatorId,
    sharedBy: student.educatorId,
    now,
  });

export const makeShareRepository = (initial: StudentShare[] = []) => {
  const store: StudentShare[] = [...initial];
  const key = (studentId: Uuid, educatorId: Uuid) => `${studentId.value}:${educatorId.value}`;
  const matches = (share: StudentShare, studentId: Uuid, educatorId: Uuid) =>
    key(share.studentId, share.educatorId) === key(studentId, educatorId);

  const repository = {
    store,
    create: vi.fn(async (share: StudentShare) => {
      if (store.some((item) => matches(item, share.studentId, share.educatorId))) return;
      store.push(share);
    }),
    find: vi.fn(
      async (studentId: Uuid, educatorId: Uuid) =>
        store.find((item) => matches(item, studentId, educatorId)) ?? null
    ),
    listByStudentId: vi.fn(async (studentId: Uuid) =>
      store
        .filter((item) => item.studentId.value === studentId.value)
        .sort((a, b) => a.sharedAt.getTime() - b.sharedAt.getTime())
    ),
    listByEducatorId: vi.fn(async (educatorId: Uuid) =>
      store.filter((item) => item.educatorId.value === educatorId.value)
    ),
    listByStudentIds: vi.fn(async (studentIds: Uuid[]) => {
      const ids = new Set(studentIds.map((id) => id.value));
      return store.filter((item) => ids.has(item.studentId.value));
    }),
    listByStudentIdsAndEducator: vi.fn(async (studentIds: Uuid[], educatorId: Uuid) => {
      const ids = new Set(studentIds.map((id) => id.value));
      return store.filter(
        (item) => ids.has(item.studentId.value) && item.educatorId.value === educatorId.value
      );
    }),
    delete: vi.fn(async (studentId: Uuid, educatorId: Uuid) => {
      const index = store.findIndex((item) => matches(item, studentId, educatorId));
      if (index >= 0) store.splice(index, 1);
    }),
    deleteForEducatorDeparture: vi.fn(async (educatorId: Uuid, ownedStudentIds: Uuid[]) => {
      const owned = new Set(ownedStudentIds.map((id) => id.value));
      const before = store.length;
      for (let i = store.length - 1; i >= 0; i--) {
        const item = store[i];
        if (item.educatorId.value === educatorId.value || owned.has(item.studentId.value)) {
          store.splice(i, 1);
        }
      }
      return before - store.length;
    }),
  };

  return repository satisfies StudentShareRepository;
};

// Serviço real de acesso sobre o repositório de alunos do spec (mock ou em
// memória) e os compartilhamentos informados.
export const makeStudentAccess = (
  studentRepository: StudentRepository,
  shares: StudentShare[] | ReturnType<typeof makeShareRepository> = []
) =>
  new StudentAccessService(
    studentRepository,
    Array.isArray(shares) ? makeShareRepository(shares) : shares
  );

// Repositório de alunos em memória, para os specs que precisam de search e
// getByIds além de getById.
export const makeStudentRepositoryFake = (initial: Student[] = []) => {
  const store = new Map(initial.map((student) => [student.id.value, student]));
  const repository = {
    store,
    save: vi.fn(async (student: Student) => {
      store.set(student.id.value, student);
      return student;
    }),
    getById: vi.fn(async (id: Uuid) => store.get(id.value) ?? null),
    getByIds: vi.fn(async (ids: Uuid[]) =>
      ids.map((id) => store.get(id.value)).filter((s): s is Student => !!s)
    ),
    search: vi.fn(async (params: { educatorId?: Uuid }) =>
      [...store.values()].filter(
        (student) => !params.educatorId || student.educatorId.value === params.educatorId.value
      )
    ),
    delete: vi.fn(async (id: Uuid) => {
      store.delete(id.value);
    }),
  };
  return repository satisfies StudentRepository;
};
