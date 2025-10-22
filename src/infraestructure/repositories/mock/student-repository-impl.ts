import { Uuid } from "@wave-telecom/framework/core";
import { Student } from "../../../domain/entities/student";
import {
  SearchStudentProps,
  StudentRepository,
} from "../../../domain/repositories/student-repository";

export class MockStudentRepository implements StudentRepository {
  private data: Student[] = [];

  async save(student: Student): Promise<Student> {
    // Se já existir, substitui; se não, adiciona
    const index = this.data.findIndex((s) => s.id === student.id);
    if (index >= 0) {
      this.data[index] = student;
    } else {
      this.data.push(student);
    }
    return student;
  }

  async getById(id: Uuid): Promise<Student | null> {
    const student = this.data.find((s) => s.id === id);
    if (!student) return null;

    return Student.create({
      id: student.id,
      name: student.name,
      age: student.age,
      gender: student.gender,
      learningTopics: [...student.learningTopics],
      createdAt: student.createdAt,
      educators: [...student.educators],
    });
  }

  async search(props: SearchStudentProps): Promise<Student[]> {
    return this.data.filter((student) => {
      if (props.id && student.id !== props.id) return false;
      if (props.name && student.name !== props.name) return false;
      if (props.age && student.age !== props.age) return false;
      if (props.gender && student.gender !== props.gender) return false;
      if (
        props.learningTopics &&
        !props.learningTopics.every((topic) =>
          student.learningTopics.includes(topic)
        )
      )
        return false;
      if (
        props.educatorId &&
        !student.educators.some((e) => e.id === props.educatorId)
      )
        return false;
      return true;
    });
  }

  async delete(id: Uuid): Promise<void> {
    this.data = this.data.filter((s) => s.id !== id);
  }
}
