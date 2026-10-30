import { success, failure, Uuid } from "@wave-telecom/framework/core";
import { TaskCategory } from "./task";

export interface CreateTaskGroupProps {
  id?: Uuid;
  name: string;
  tasksIds?: string[];
  educatorId: Uuid;
  category: TaskCategory;
}

export interface UpdateTaskGroupProps {
  name?: string;
  tasksIds?: string[];
  category?: TaskCategory;
}

export class TaskGroup {
  constructor(
    readonly id: Uuid,
    readonly name: string,
    readonly tasksIds: string[],
    readonly educatorId: Uuid,
    readonly category: TaskCategory
  ) {}

  static create(props: CreateTaskGroupProps) {
    const id = props.id ?? Uuid.random();
    return new TaskGroup(
      id,
      props.name,
      props.tasksIds ?? [],
      props.educatorId,
      props.category
    );
  }

  public updateTaskGroup(props: UpdateTaskGroupProps) {
    try {
      const updatedTaskGroup = new TaskGroup(
        this.id,
        props.name ?? this.name,
        props.tasksIds ?? this.tasksIds,
        this.educatorId,
        props.category ?? this.category
      );

      return success(updatedTaskGroup);
    } catch (e) {
      return failure("INVALID_TASK_GROUP_DATA");
    } 
  }
}
