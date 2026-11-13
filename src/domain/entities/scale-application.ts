import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { ScaleAnswer, ScaleTemplate } from "./scale-template";

export enum ApplicationStatus {
  DRAFT = "DRAFT",
  COMPLETED = "COMPLETED",
}

export interface ScaleInsight {
  text: string;
  generatedAt: Date;
  preliminary: boolean;
}

export interface ScaleApplicationProps {
  id: Uuid;
  templateId: Uuid;
  templateCode: string;
  templateVersion: number;
  templateName: string;
  studentId: Uuid;
  educatorId: Uuid;
  appointmentId?: Uuid;
  status: ApplicationStatus;
  answers: ScaleAnswer[];
  insight?: ScaleInsight;
  startedAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

export interface StartScaleApplicationProps {
  template: ScaleTemplate;
  studentId: Uuid;
  educatorId: Uuid;
  appointmentId?: Uuid;
}

export type ScaleApplicationError =
  | "SCALE_INACTIVE"
  | "APPLICATION_NOT_EDITABLE"
  | "ITEM_NOT_IN_SCALE"
  | "INVALID_ANSWER_VALUE";

// O escore não é gravado: é derivado das respostas com o template da versão
// gravada (AV-02, AV-05).
export class ScaleApplication {
  private constructor(private readonly props: ScaleApplicationProps) {}

  static start(props: StartScaleApplicationProps) {
    const { template } = props;
    if (!template.active) return failure<ScaleApplicationError>("SCALE_INACTIVE");

    const now = new Date();

    return success(
      new ScaleApplication({
        id: Uuid.random(),
        templateId: template.id,
        templateCode: template.code,
        templateVersion: template.version,
        templateName: template.name,
        studentId: props.studentId,
        educatorId: props.educatorId,
        appointmentId: props.appointmentId,
        status: ApplicationStatus.DRAFT,
        answers: [],
        startedAt: now,
        updatedAt: now,
      })
    );
  }

  static fromPersistence(props: ScaleApplicationProps): ScaleApplication {
    return new ScaleApplication(props);
  }

  get id(): Uuid {
    return this.props.id;
  }

  get templateId(): Uuid {
    return this.props.templateId;
  }

  get templateCode(): string {
    return this.props.templateCode;
  }

  get templateVersion(): number {
    return this.props.templateVersion;
  }

  get templateName(): string {
    return this.props.templateName;
  }

  get studentId(): Uuid {
    return this.props.studentId;
  }

  get educatorId(): Uuid {
    return this.props.educatorId;
  }

  get appointmentId(): Uuid | undefined {
    return this.props.appointmentId;
  }

  get status(): ApplicationStatus {
    return this.props.status;
  }

  get answers(): ScaleAnswer[] {
    return this.props.answers;
  }

  get insight(): ScaleInsight | undefined {
    return this.props.insight;
  }

  get startedAt(): Date {
    return this.props.startedAt;
  }

  get updatedAt(): Date {
    return this.props.updatedAt;
  }

  get completedAt(): Date | undefined {
    return this.props.completedAt;
  }

  get isEditable(): boolean {
    return this.props.status === ApplicationStatus.DRAFT;
  }

  // AV-08: só rascunho pode ser excluído.
  get canBeDeleted(): boolean {
    return this.props.status === ApplicationStatus.DRAFT;
  }

  // Gravação parcial idempotente: upsert por itemId (AV-04). O template é o
  // da versão gravada na aplicação.
  saveAnswers(template: ScaleTemplate, answers: ScaleAnswer[]) {
    if (!this.isEditable) return failure<ScaleApplicationError>("APPLICATION_NOT_EDITABLE");

    for (const answer of answers) {
      if (!template.hasItem(answer.itemId)) {
        return failure<ScaleApplicationError>("ITEM_NOT_IN_SCALE");
      }
      if (!template.isValidOptionValue(answer.value)) {
        return failure<ScaleApplicationError>("INVALID_ANSWER_VALUE");
      }
    }

    const valueByItem = new Map(
      this.props.answers.map((answer) => [answer.itemId, answer.value])
    );
    for (const answer of answers) valueByItem.set(answer.itemId, answer.value);

    // Guarda na ordem de aplicação dos itens.
    const merged = template.items
      .filter((item) => valueByItem.has(item.id))
      .map((item) => ({ itemId: item.id, value: valueByItem.get(item.id) as number }));

    return success(
      new ScaleApplication({ ...this.props, answers: merged, updatedAt: new Date() })
    );
  }

  // AV-07: exige todos os itens; depois fica somente leitura.
  complete(template: ScaleTemplate) {
    if (!this.isEditable) return failure("APPLICATION_NOT_EDITABLE" as const);

    const answered = new Set(this.props.answers.map((answer) => answer.itemId));
    const missingItemIds = template.items
      .filter((item) => !answered.has(item.id))
      .map((item) => item.id);

    if (missingItemIds.length > 0) {
      return failure({ code: "SCALE_INCOMPLETE" as const, missingItemIds });
    }

    const now = new Date();
    return success(
      new ScaleApplication({
        ...this.props,
        status: ApplicationStatus.COMPLETED,
        completedAt: now,
        updatedAt: now,
      })
    );
  }
}
