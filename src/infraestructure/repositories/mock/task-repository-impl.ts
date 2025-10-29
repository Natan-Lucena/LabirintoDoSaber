import { Uuid } from "@wave-telecom/framework/core";
import { Task } from "../../../domain/entities/task";
import {
  SearchTaskProps,
  TaskRepository,
} from "../../../domain/repositories/task-repository";

export class MockTaskRepository implements TaskRepository {
  private data: Task[] = [];

  async save(task: Task): Promise<void> {
    const index = this.data.findIndex((t) => t.id === task.id);
    if (index >= 0) {
      this.data[index] = task;
    } else {
      this.data.push(task);
    }
  }

  async getById(id: Uuid): Promise<Task | null> {
    const task = this.data.find((t) => t.id === id);
    if (!task) return null;

    return task;
  }

  async search(params: SearchTaskProps): Promise<Task[]> {
    const { id, category, type, promptContains } = params;

    return this.data.filter((task) => {
      if (id && task.id !== id) return false;

      if (category && task.category !== category) return false;

      if (type && task.type !== type) return false;

      if (promptContains) {
        const normalizedPrompt = task.prompt.toLowerCase();
        const normalizedSearch = promptContains.toLowerCase();
        if (!normalizedPrompt.includes(normalizedSearch)) return false;
      }

      return true;
    });
  }

  async delete(id: Uuid): Promise<void> {
    this.data = this.data.filter((t) => t.id !== id);
  }
}
