import { failure, success, Uuid } from "@wave-telecom/framework/core";

export enum ScaleRespondent {
  PROFESSIONAL = "PROFESSIONAL",
  GUARDIAN = "GUARDIAN",
  TEACHER = "TEACHER",
}

export enum BandSeverity {
  LOW = "LOW",
  MODERATE = "MODERATE",
  HIGH = "HIGH",
}

export enum ScoringMethod {
  SUM = "SUM",
  MEAN = "MEAN",
}

export const MIN_SCALE_OPTIONS = 2;
export const MAX_SCALE_OPTIONS = 7;

// Passo entre faixas de MEAN (média com duas casas).
const MEAN_STEP = 0.01;
const EPSILON = 1e-9;

export interface ScaleOption {
  value: number;
  label: string;
}

export interface ScaleItem {
  id: string;
  order: number;
  text: string;
  subscaleCode?: string;
}

export interface ScaleSubscale {
  code: string;
  name: string;
}

export interface ScaleBand {
  // Ausente: faixa do escore total.
  subscaleCode?: string;
  min: number;
  max: number;
  label: string;
  severity: BandSeverity;
}

export interface ScaleScoring {
  method: ScoringMethod;
  bands: ScaleBand[];
}

// Conteúdo publicado de uma versão (o JSON de scales/, sem id).
export interface ScaleDefinition {
  code: string;
  version: number;
  name: string;
  description: string;
  instructions: string;
  respondent: ScaleRespondent;
  ageRange?: { min: number; max: number };
  estimatedMinutes: number;
  options: ScaleOption[];
  items: ScaleItem[];
  subscales: ScaleSubscale[];
  scoring: ScaleScoring;
  disclaimer: string;
  reference: string;
  active: boolean;
}

export interface ScaleTemplateProps extends ScaleDefinition {
  id: Uuid;
}

export interface ScaleAnswer {
  itemId: string;
  value: number;
}

export interface ScoreBand {
  label: string;
  severity: BandSeverity;
}

export interface SubscaleScore {
  code: string;
  name: string;
  answered: number;
  total: number;
  value: number;
  max: number;
  band?: ScoreBand;
}

export interface ScaleScore {
  partial: boolean;
  answered: number;
  total: number;
  value: number;
  max: number;
  band?: ScoreBand;
  subscales: SubscaleScore[];
}

const targetName = (subscaleCode?: string) =>
  subscaleCode ? `subescala ${subscaleCode}` : "total";

const duplicates = <T>(values: T[]) =>
  [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];

const round2 = (value: number) => Math.round(value * 100) / 100;

// Intervalo possível de um alvo com n itens (AV-10).
function possibleRange(definition: ScaleDefinition, itemCount: number) {
  const values = definition.options.map((option) => option.value);
  const minOption = Math.min(...values);
  const maxOption = Math.max(...values);

  if (definition.scoring.method === ScoringMethod.MEAN) {
    return { min: minOption, max: maxOption };
  }
  return { min: itemCount * minOption, max: itemCount * maxOption };
}

function validateBandCoverage(
  definition: ScaleDefinition,
  subscaleCode: string | undefined,
  itemCount: number
): string[] {
  const target = targetName(subscaleCode);
  const bands = definition.scoring.bands
    .filter((band) => band.subscaleCode === subscaleCode)
    .sort((a, b) => a.min - b.min);

  if (bands.length === 0) return [`MISSING_BANDS: ${target} sem faixas`];

  const errors: string[] = [];
  for (const band of bands) {
    if (band.min > band.max) {
      errors.push(`INVALID_BAND: ${target} com faixa ${band.min}–${band.max}`);
    }
  }

  const range = possibleRange(definition, itemCount);
  if (Math.abs(bands[0].min - range.min) > EPSILON) {
    errors.push(`BAND_RANGE: ${target} deve começar em ${range.min}, começa em ${bands[0].min}`);
  }
  const last = bands[bands.length - 1];
  if (Math.abs(last.max - range.max) > EPSILON) {
    errors.push(`BAND_RANGE: ${target} deve terminar em ${range.max}, termina em ${last.max}`);
  }

  // Faixas fechadas: o min de uma é o max da anterior mais um passo.
  const isMean = definition.scoring.method === ScoringMethod.MEAN;
  for (let i = 1; i < bands.length; i++) {
    const gap = bands[i].min - bands[i - 1].max;
    const between = `${bands[i - 1].max} e ${bands[i].min}`;
    if (gap <= EPSILON) {
      errors.push(`BAND_OVERLAP: ${target} entre ${between}`);
    } else if (gap > (isMean ? MEAN_STEP : 1) + EPSILON) {
      errors.push(`BAND_GAP: ${target} entre ${between}`);
    }
  }

  return errors;
}

// Função pura: devolve a lista de erros da definição (vazia se válida).
export function validateDefinition(definition: ScaleDefinition): string[] {
  const errors: string[] = [];
  const { options, items, subscales, scoring } = definition;

  if (!definition.code.trim()) errors.push("INVALID_CODE: code vazio");
  if (!Number.isInteger(definition.version) || definition.version < 1) {
    errors.push("INVALID_VERSION: version deve ser inteiro a partir de 1");
  }
  if (!Number.isInteger(definition.estimatedMinutes) || definition.estimatedMinutes < 1) {
    errors.push("INVALID_ESTIMATED_MINUTES: estimatedMinutes deve ser inteiro positivo");
  }
  if (definition.ageRange && definition.ageRange.min > definition.ageRange.max) {
    errors.push("INVALID_AGE_RANGE: min maior que max");
  }

  if (options.length < MIN_SCALE_OPTIONS || options.length > MAX_SCALE_OPTIONS) {
    errors.push(
      `INVALID_OPTIONS: ${options.length} opções (de ${MIN_SCALE_OPTIONS} a ${MAX_SCALE_OPTIONS})`
    );
  }
  for (const value of duplicates(options.map((option) => option.value))) {
    errors.push(`DUPLICATE_OPTION_VALUE: ${value}`);
  }
  if (
    scoring.method === ScoringMethod.SUM &&
    options.some((option) => !Number.isInteger(option.value))
  ) {
    errors.push("NON_INTEGER_OPTION: SUM exige opções inteiras");
  }

  if (items.length === 0) errors.push("NO_ITEMS: escala sem itens");
  for (const id of duplicates(items.map((item) => item.id))) {
    errors.push(`DUPLICATE_ITEM_ID: ${id}`);
  }
  for (const order of duplicates(items.map((item) => item.order))) {
    errors.push(`DUPLICATE_ITEM_ORDER: ${order}`);
  }

  const subscaleCodes = subscales.map((subscale) => subscale.code);
  for (const code of duplicates(subscaleCodes)) {
    errors.push(`DUPLICATE_SUBSCALE: ${code}`);
  }
  for (const item of items) {
    if (item.subscaleCode && !subscaleCodes.includes(item.subscaleCode)) {
      errors.push(`UNKNOWN_SUBSCALE: item ${item.id} usa ${item.subscaleCode}`);
    }
  }
  for (const band of scoring.bands) {
    if (band.subscaleCode && !subscaleCodes.includes(band.subscaleCode)) {
      errors.push(`UNKNOWN_SUBSCALE: faixa "${band.label}" usa ${band.subscaleCode}`);
    }
  }

  // Sem opções suficientes não há intervalo possível para conferir faixas.
  if (options.length === 0 || items.length === 0) return errors;

  errors.push(...validateBandCoverage(definition, undefined, items.length));
  for (const code of new Set(subscaleCodes)) {
    const itemCount = items.filter((item) => item.subscaleCode === code).length;
    if (itemCount === 0) {
      errors.push(`EMPTY_SUBSCALE: subescala ${code} sem itens`);
      continue;
    }
    errors.push(...validateBandCoverage(definition, code, itemCount));
  }

  return errors;
}

export class ScaleTemplate {
  private constructor(private readonly props: ScaleTemplateProps) {}

  static create(definition: ScaleDefinition) {
    const errors = validateDefinition(definition);
    if (errors.length > 0) {
      return failure({ code: "INVALID_SCALE_DEFINITION" as const, errors });
    }
    return success(new ScaleTemplate({ ...definition, id: Uuid.random() }));
  }

  static fromPersistence(props: ScaleTemplateProps): ScaleTemplate {
    return new ScaleTemplate(props);
  }

  get id(): Uuid {
    return this.props.id;
  }

  get code(): string {
    return this.props.code;
  }

  get version(): number {
    return this.props.version;
  }

  get name(): string {
    return this.props.name;
  }

  get description(): string {
    return this.props.description;
  }

  get instructions(): string {
    return this.props.instructions;
  }

  get respondent(): ScaleRespondent {
    return this.props.respondent;
  }

  get ageRange(): { min: number; max: number } | undefined {
    return this.props.ageRange;
  }

  get estimatedMinutes(): number {
    return this.props.estimatedMinutes;
  }

  get options(): ScaleOption[] {
    return this.props.options;
  }

  // Na ordem de aplicação.
  get items(): ScaleItem[] {
    return [...this.props.items].sort((a, b) => a.order - b.order);
  }

  get subscales(): ScaleSubscale[] {
    return this.props.subscales;
  }

  get scoring(): ScaleScoring {
    return this.props.scoring;
  }

  get disclaimer(): string {
    return this.props.disclaimer;
  }

  get reference(): string {
    return this.props.reference;
  }

  get active(): boolean {
    return this.props.active;
  }

  // O conteúdo publicado, sem o id; o seed compara versões por ele.
  get definition(): ScaleDefinition {
    const { id: _id, ...definition } = this.props;
    return definition;
  }

  hasItem(itemId: string): boolean {
    return this.props.items.some((item) => item.id === itemId);
  }

  isValidOptionValue(value: number): boolean {
    return this.props.options.some((option) => option.value === value);
  }

  // Escore derivado das respostas (AV-05). Respostas de itens fora da escala
  // são ignoradas. Com resposta parcial, a faixa sai do valor parcial (AV-06).
  computeScore(answers: ScaleAnswer[]): ScaleScore {
    const answerByItem = new Map(answers.map((answer) => [answer.itemId, answer.value]));

    const total = this.scoreTarget(this.props.items, undefined, answerByItem);

    return {
      partial: total.answered < total.total,
      ...total,
      subscales: this.props.subscales.map((subscale) => ({
        code: subscale.code,
        name: subscale.name,
        ...this.scoreTarget(
          this.props.items.filter((item) => item.subscaleCode === subscale.code),
          subscale.code,
          answerByItem
        ),
      })),
    };
  }

  private scoreTarget(
    items: ScaleItem[],
    subscaleCode: string | undefined,
    answerByItem: Map<string, number>
  ) {
    const values = items
      .filter((item) => answerByItem.has(item.id))
      .map((item) => answerByItem.get(item.id) as number);
    const sum = values.reduce((acc, value) => acc + value, 0);
    const isMean = this.props.scoring.method === ScoringMethod.MEAN;
    const value = isMean ? (values.length > 0 ? round2(sum / values.length) : 0) : sum;

    return {
      answered: values.length,
      total: items.length,
      value,
      max: possibleRange(this.props, items.length).max,
      band: values.length > 0 ? this.findBand(subscaleCode, value) : undefined,
    };
  }

  private findBand(subscaleCode: string | undefined, value: number): ScoreBand | undefined {
    const band = this.props.scoring.bands.find(
      (candidate) =>
        candidate.subscaleCode === subscaleCode &&
        value >= candidate.min - EPSILON &&
        value <= candidate.max + EPSILON
    );
    return band ? { label: band.label, severity: band.severity } : undefined;
  }
}
