import { TaskCategory } from "../entities/task";

export interface GenerateTasksParams {
  targetAudience: string;
  instructions: string;
  quantity: number;
  category: TaskCategory;
}

export interface GeneratedTaskAlternative {
  text: string;
  isCorrect: boolean;
}

export interface GeneratedTaskDraft {
  prompt: string;
  alternatives: GeneratedTaskAlternative[];
}

export interface AiTaskGeneratorService {
  generate(params: GenerateTasksParams): Promise<GeneratedTaskDraft[]>;
}
