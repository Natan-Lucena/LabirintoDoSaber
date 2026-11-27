import { failure, Result, success, Uuid } from "@wave-telecom/framework/core";

export const CLINIC_NAME_MIN = 2;
export const CLINIC_NAME_MAX = 80;

export type TeamRole = "ADMIN" | "PROFESSIONAL";
export const TEAM_ROLES: readonly TeamRole[] = ["ADMIN", "PROFESSIONAL"];

export interface ClinicProps {
  id: Uuid;
  name: string;
  createdAt: Date;
}

function normalizeName(name: string): Result<string, "INVALID_CLINIC_NAME"> {
  const trimmed = name.trim();
  if (trimmed.length < CLINIC_NAME_MIN || trimmed.length > CLINIC_NAME_MAX) {
    return failure("INVALID_CLINIC_NAME");
  }
  return success(trimmed);
}

// Clínica: reúne educadores (G-62). Não dá acesso automático aos pacientes.
export class Clinic {
  private constructor(private readonly props: ClinicProps) {}

  static create(props: { name: string; now?: Date }) {
    const name = normalizeName(props.name);
    if (!name.ok) return name;

    return success(
      new Clinic({ id: Uuid.random(), name: name.value, createdAt: props.now ?? new Date() })
    );
  }

  static fromPersistence(props: ClinicProps): Clinic {
    return new Clinic(props);
  }

  rename(name: string) {
    const normalized = normalizeName(name);
    if (!normalized.ok) return normalized;
    return success(new Clinic({ ...this.props, name: normalized.value }));
  }

  get id(): Uuid {
    return this.props.id;
  }

  get name(): string {
    return this.props.name;
  }

  get createdAt(): Date {
    return this.props.createdAt;
  }
}
