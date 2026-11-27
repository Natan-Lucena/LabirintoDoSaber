import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { normalizeText } from "../utils/text";

// Habilidade do catálogo fixo (AT-12), carregado por seed. `learningTopics`
// liga a habilidade aos temas de aprendizagem do aluno (AT-08).
export interface TaskSkillProps {
  id: Uuid;
  code: string;
  label: string;
  learningTopics: string[];
  order: number;
}

export type TaskSkillDefinition = Omit<TaskSkillProps, "id">;

const CODE = /^[A-Z][A-Z0-9_]{1,39}$/;

// Namespace dos ids determinísticos do seed (habilidades e biblioteca).
export const TASK_LIBRARY_NAMESPACE = "8f7c2b1e-4d3a-4c5b-9e6f-1a2b3c4d5e6f";

// Só letras e números, separados por um espaço.
const words = (value: string) =>
  normalizeText(value).replace(/[^a-z0-9]+/g, " ").trim();

export class TaskSkill {
  private constructor(private readonly props: TaskSkillProps) {}

  static create(definition: TaskSkillDefinition) {
    const errors: string[] = [];
    if (!CODE.test(definition.code)) errors.push(`INVALID_CODE: ${definition.code}`);
    if (!definition.label?.trim() || definition.label.trim().length > 60) {
      errors.push(`INVALID_LABEL: ${definition.code}`);
    }
    if (
      !Array.isArray(definition.learningTopics) ||
      definition.learningTopics.length === 0 ||
      definition.learningTopics.some((topic) => !topic?.trim())
    ) {
      errors.push(`INVALID_LEARNING_TOPICS: ${definition.code}`);
    }
    if (!Number.isInteger(definition.order)) errors.push(`INVALID_ORDER: ${definition.code}`);
    if (errors.length > 0) return failure({ code: "INVALID_SKILL" as const, errors });

    return success(
      new TaskSkill({
        id: Uuid.fromSeed(`task-skill:${definition.code}`, TASK_LIBRARY_NAMESPACE),
        code: definition.code,
        label: definition.label.trim(),
        learningTopics: definition.learningTopics.map((topic) => topic.trim()),
        order: definition.order,
      })
    );
  }

  static fromPersistence(props: TaskSkillProps): TaskSkill {
    return new TaskSkill(props);
  }

  get id(): Uuid {
    return this.props.id;
  }

  get code(): string {
    return this.props.code;
  }

  get label(): string {
    return this.props.label;
  }

  get learningTopics(): string[] {
    return [...this.props.learningTopics];
  }

  get order(): number {
    return this.props.order;
  }

  // Casa com os temas do aluno ignorando acento, maiúscula e pontuação: o
  // tópico do catálogo pode ser o tema inteiro ou aparecer nele como
  // palavra(s) inteira(s) ("Dificuldade de leitura" casa com "leitura").
  matchesAnyTopic(topics: string[]): boolean {
    const studentTopics = topics.map(words).filter(Boolean).map((topic) => ` ${topic} `);
    return this.props.learningTopics.some((topic) => {
      const needle = words(topic);
      return !!needle && studentTopics.some((topic) => topic.includes(` ${needle} `));
    });
  }

  toJSON() {
    return {
      code: this.props.code,
      label: this.props.label,
      learningTopics: [...this.props.learningTopics],
    };
  }
}
