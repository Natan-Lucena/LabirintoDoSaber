import { failure, success, Uuid } from "@wave-telecom/framework/core";

export const HELP_TITLE_MAX = 80;
export const HELP_DESCRIPTION_MAX = 200;
export const HELP_STEPS_MAX = 10;
export const HELP_STEP_MAX = 300;
export const HELP_URL_MAX = 2048;

export interface HelpTutorialProps {
  id: Uuid;
  order: number;
  title: string;
  description: string;
  durationSeconds: number;
  featured: boolean;
  // AJ-02: arquivo direto em HTTPS, MP4 ou HLS.
  videoUrl?: string;
  thumbnailUrl?: string;
  steps?: string[];
}

export interface HelpTutorialError {
  code: "INVALID_HELP_TUTORIAL";
  errors: string[];
}

const httpsUrl = (value: string) => {
  if (value.length > HELP_URL_MAX) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
};

// Tutorial da central de ajuda (§8). Sem vídeo, o app mostra os passos (AJ-03).
export class HelpTutorial {
  private constructor(private readonly props: HelpTutorialProps) {}

  static create(props: HelpTutorialProps) {
    const errors: string[] = [];
    const title = props.title.trim();
    const description = props.description.trim();
    const steps = props.steps?.map((step) => step.trim());

    if (!Number.isInteger(props.order) || props.order < 0) {
      errors.push("order: inteiro maior ou igual a 0");
    }
    if (!title || title.length > HELP_TITLE_MAX) {
      errors.push(`title: obrigatório, até ${HELP_TITLE_MAX} caracteres`);
    }
    if (!description || description.length > HELP_DESCRIPTION_MAX) {
      errors.push(`description: obrigatória, até ${HELP_DESCRIPTION_MAX} caracteres`);
    }
    if (!Number.isInteger(props.durationSeconds) || props.durationSeconds < 0) {
      errors.push("durationSeconds: inteiro maior ou igual a 0");
    }
    if (props.videoUrl !== undefined) {
      const url = httpsUrl(props.videoUrl);
      if (!url || !/\.(mp4|m3u8)$/i.test(url.pathname)) {
        errors.push("videoUrl: arquivo direto em https, MP4 ou HLS (.m3u8)");
      }
    }
    if (props.thumbnailUrl !== undefined && !httpsUrl(props.thumbnailUrl)) {
      errors.push("thumbnailUrl: URL https");
    }
    if (steps !== undefined) {
      if (steps.length > HELP_STEPS_MAX) {
        errors.push(`steps: no máximo ${HELP_STEPS_MAX}`);
      } else if (steps.some((step) => !step || step.length > HELP_STEP_MAX)) {
        errors.push(`steps: cada passo com 1 a ${HELP_STEP_MAX} caracteres`);
      }
    }
    if (props.videoUrl === undefined && !steps?.length) {
      errors.push("steps: sem vídeo, o tutorial precisa de passos");
    }

    if (errors.length > 0) {
      return failure<HelpTutorialError>({ code: "INVALID_HELP_TUTORIAL", errors });
    }

    return success(
      new HelpTutorial({
        ...props,
        title,
        description,
        steps: steps?.length ? steps : undefined,
      })
    );
  }

  static fromPersistence(props: HelpTutorialProps): HelpTutorial {
    return new HelpTutorial(props);
  }

  get id(): Uuid {
    return this.props.id;
  }

  get order(): number {
    return this.props.order;
  }

  get title(): string {
    return this.props.title;
  }

  get description(): string {
    return this.props.description;
  }

  get durationSeconds(): number {
    return this.props.durationSeconds;
  }

  get featured(): boolean {
    return this.props.featured;
  }

  get videoUrl(): string | undefined {
    return this.props.videoUrl;
  }

  get thumbnailUrl(): string | undefined {
    return this.props.thumbnailUrl;
  }

  get steps(): string[] | undefined {
    return this.props.steps ? [...this.props.steps] : undefined;
  }
}
