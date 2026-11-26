import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { Student } from "../entities/student";
import { StudentRepository } from "../repositories/student-repository";
import { StudentShareRepository } from "../repositories/student-share-repository";

// "clinical": dono ou compartilhado (EQ-11) — sessões, evolução, planos,
// escalas, anamnese, relatórios, atendimentos, análises.
// "owner": só o dono — cadastro, documentos, compartilhar, transferir.
export type StudentAccessMode = "clinical" | "owner";

export type StudentAccessKind = "OWNER" | "SHARED";

export interface AccessibleStudent {
  student: Student;
  access: StudentAccessKind;
}

// Ponto único da regra de acesso ao paciente. Fora do alcance:
// UNAUTHORIZED (403); inexistente: STUDENT_NOT_FOUND (404).
export class StudentAccessService {
  constructor(
    private studentRepository: StudentRepository,
    private shareRepository: StudentShareRepository
  ) {}

  async assertStudentAccess(
    studentId: Uuid,
    educatorId: Uuid,
    options: { mode: StudentAccessMode } = { mode: "clinical" }
  ) {
    const student = await this.studentRepository.getById(studentId);
    if (!student) return failure("STUDENT_NOT_FOUND");

    const access = await this.accessOf(student, educatorId);
    if (!access || (options.mode === "owner" && access !== "OWNER")) {
      return failure("UNAUTHORIZED");
    }

    return success(student);
  }

  // PA-04: acesso clínico para criar registro novo (atendimento, série,
  // sessão, plano, aplicação de escala). Arquivado: STUDENT_ARCHIVED (409).
  async assertActiveStudentAccess(studentId: Uuid, educatorId: Uuid) {
    const access = await this.assertStudentAccess(studentId, educatorId);
    if (!access.ok) return access;
    if (access.value.isArchived) return failure("STUDENT_ARCHIVED");
    return access;
  }

  // Acesso do educador a um aluno já carregado; undefined = nenhum.
  async accessOf(student: Student, educatorId: Uuid): Promise<StudentAccessKind | undefined> {
    if (student.educatorId.value === educatorId.value) return "OWNER";
    const share = await this.shareRepository.find(student.id, educatorId);
    return share ? "SHARED" : undefined;
  }

  // Dos alunos informados, os que o educador acessa (dono ou compartilhado),
  // numa consulta de compartilhamentos só.
  async filterAccessible(students: Student[], educatorId: Uuid): Promise<Student[]> {
    const notOwned = students.filter(
      (student) => student.educatorId.value !== educatorId.value
    );
    if (notOwned.length === 0) return students;

    const shares = await this.shareRepository.listByStudentIdsAndEducator(
      notOwned.map((student) => student.id),
      educatorId
    );
    const shared = new Set(shares.map((share) => share.studentId.value));

    return students.filter(
      (student) =>
        student.educatorId.value === educatorId.value || shared.has(student.id.value)
    );
  }

  // Ids, entre os informados, dos alunos que o educador acessa.
  async accessibleIdsAmong(studentIds: Uuid[], educatorId: Uuid): Promise<Set<string>> {
    const unique = [...new Set(studentIds.map((id) => id.value))];
    if (unique.length === 0) return new Set();

    const students = await this.studentRepository.getByIds(unique.map((id) => new Uuid(id)));
    const accessible = await this.filterAccessible(students, educatorId);
    return new Set(accessible.map((student) => student.id.value));
  }

  // Todos os alunos do educador: os dele e os compartilhados com ele (EQ-13).
  async listAccessibleStudents(educatorId: Uuid): Promise<AccessibleStudent[]> {
    const [owned, shares] = await Promise.all([
      this.studentRepository.search({ educatorId }),
      this.shareRepository.listByEducatorId(educatorId),
    ]);

    const ownedIds = new Set(owned.map((student) => student.id.value));
    const sharedIds = shares
      .map((share) => share.studentId)
      .filter((id) => !ownedIds.has(id.value));
    const shared = sharedIds.length > 0 ? await this.studentRepository.getByIds(sharedIds) : [];

    return [
      ...owned.map((student) => ({ student, access: "OWNER" as const })),
      ...shared.map((student) => ({ student, access: "SHARED" as const })),
    ];
  }
}
