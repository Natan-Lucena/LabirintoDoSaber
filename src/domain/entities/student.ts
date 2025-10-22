import { Uuid } from "@wave-telecom/framework/core";
import { Educator } from "./educator";

export enum Gender {
  Male = "male",
  Female = "female",
}

export interface CreateStudentProps {
  id?: Uuid;
  createdAt?: Date;
  name: string;
  age: number;
  gender: Gender;
  learningTopics: string[];
  educators: Educator[];
}

export class Student {
  private constructor(
    public readonly id: Uuid,
    public readonly name: string,
    public readonly age: number,
    public readonly gender: Gender,
    public readonly learningTopics: string[],
    public readonly createdAt: Date,
    public readonly educators: Educator[]
  ) {}

  static create(props: CreateStudentProps) {
    return new Student(
      props.id || Uuid.random(),
      props.name,
      props.age,
      props.gender,
      props.learningTopics,
      props.createdAt || new Date(),
      props.educators
    );
  }

  assignEducator(educator: Educator) {
    this.educators.push(educator);
  }
}
