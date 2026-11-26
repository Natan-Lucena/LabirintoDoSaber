import { Uuid } from "@wave-telecom/framework/core";
import { isUsableBy, Task, TaskSource } from "../../../domain/entities/task";
import { TaskRepository } from "../../../domain/repositories/task-repository";

export class MockTaskRepository implements TaskRepository {
  private data: Task[] = [];

  async save(task: Task): Promise<void> {
    const index = this.data.findIndex((t) => t.id.value === task.id.value);
    if (index >= 0) {
      this.data[index] = task;
    } else {
      this.data.push(task);
    }
  }

  async saveMany(tasks: Task[]): Promise<void> {
    for (const task of tasks) {
      await this.save(task);
    }
  }

  async getById(id: Uuid): Promise<Task | null> {
    return this.data.find((t) => t.id.value === id.value) ?? null;
  }

  async getByIds(ids: Uuid[]): Promise<Task[]> {
    const idSet = new Set(ids.map((id) => id.value));
    return this.data.filter((t) => idSet.has(t.id.value));
  }

  // Sem cadernos e grupos aqui: toda antiga sem dono é legado avulso.
  async listByEducator(educatorId: Uuid): Promise<Task[]> {
    return this.data.filter((t) => !t.isLibrary && isUsableBy(t, educatorId));
  }

  async findLegacyOwners(taskIds: Uuid[]): Promise<Map<string, string[]>> {
    return new Map(taskIds.map((id) => [id.value, []]));
  }

  async listLibrary(): Promise<Task[]> {
    return this.data.filter((t) => t.source === TaskSource.Library);
  }

  async delete(id: Uuid): Promise<void> {
    this.data = this.data.filter((t) => t.id.value !== id.value);
  }
}
