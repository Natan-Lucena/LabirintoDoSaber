import { failure, success } from "@wave-telecom/framework/core";
import {
  Task,
  TaskCategory,
  TaskType,
} from "../../../../../domain/entities/task";
import { AiTaskGeneratorService } from "../../../../../domain/services/ai-task-generator-service";

interface GenerateTasksUseCaseRequest {
  targetAudience: string;
  instructions: string;
  quantity: number;
  category: TaskCategory;
}

export interface GeneratedTaskOutput {
  category: TaskCategory;
  type: TaskType;
  prompt: string;
  alternatives: { text: string; isCorrect: boolean }[];
}

export class GenerateTasksUseCase {
  constructor(private aiTaskGenerator: AiTaskGeneratorService) {}

  async execute(request: GenerateTasksUseCaseRequest) {
    if (
      !Number.isInteger(request.quantity) ||
      request.quantity < 1 ||
      request.quantity > 15
    ) {
      return failure("INVALID_QUANTITY");
    }

    let drafts;
    try {
      drafts = await this.aiTaskGenerator.generate({
        targetAudience: request.targetAudience,
        instructions: request.instructions,
        quantity: request.quantity,
        category: request.category,
      });
    } catch {
      return failure("AI_GENERATION_FAILED");
    }

    const tasks: GeneratedTaskOutput[] = [];
    for (const draft of drafts) {
      // A geração por IA produz somente atividades de texto (MultipleChoice).
      // Validamos via Task.create para garantir as invariantes de domínio
      // (>= 2 alternativas, exatamente 1 correta) sem persistir nada.
      const taskResult = Task.create({
        category: request.category,
        type: TaskType.MultipleChoice,
        prompt: draft.prompt,
        alternatives: draft.alternatives,
      });

      if (!taskResult.ok) {
        continue;
      }

      const task = taskResult.value;
      tasks.push({
        category: task.category,
        type: task.type,
        prompt: task.prompt,
        alternatives: task.alternatives.map((alt) => ({
          text: alt.text,
          isCorrect: alt.isCorrect,
        })),
      });
    }

    if (tasks.length === 0) {
      return failure("AI_INVALID_OUTPUT");
    }

    return success({ tasks });
  }
}
