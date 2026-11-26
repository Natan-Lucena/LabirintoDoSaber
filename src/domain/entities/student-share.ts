import { Uuid } from "@wave-telecom/framework/core";

export interface StudentShareProps {
  id: Uuid;
  studentId: Uuid;
  // Com quem o paciente foi compartilhado.
  educatorId: Uuid;
  // Quem compartilhou (o dono na hora do compartilhamento).
  sharedBy: Uuid;
  sharedAt: Date;
}

// Paciente compartilhado pelo dono com um colega da mesma clínica (EQ-10).
// Um por (studentId, educatorId).
export class StudentShare {
  private constructor(private readonly props: StudentShareProps) {}

  static create(props: { studentId: Uuid; educatorId: Uuid; sharedBy: Uuid; now?: Date }) {
    return new StudentShare({
      id: Uuid.random(),
      studentId: props.studentId,
      educatorId: props.educatorId,
      sharedBy: props.sharedBy,
      sharedAt: props.now ?? new Date(),
    });
  }

  static fromPersistence(props: StudentShareProps): StudentShare {
    return new StudentShare(props);
  }

  get id(): Uuid {
    return this.props.id;
  }

  get studentId(): Uuid {
    return this.props.studentId;
  }

  get educatorId(): Uuid {
    return this.props.educatorId;
  }

  get sharedBy(): Uuid {
    return this.props.sharedBy;
  }

  get sharedAt(): Date {
    return this.props.sharedAt;
  }
}
