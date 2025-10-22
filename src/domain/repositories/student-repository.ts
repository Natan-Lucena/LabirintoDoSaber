import { Uuid } from "@wave-telecom/framework/core";
import { Gender, Student } from "../entities/student";

export interface SearchStudentProps {
  id?: Uuid;
  name?: string;
  age?: number;
  gender?: Gender;
  learningTopics?: string[];
  educatorId?: Uuid;
}

export interface StudentRepository {
  save(student: Student): Promise<Student>;
  getById(id: Uuid): Promise<Student | null>;
  search(params: SearchStudentProps): Promise<Student[]>;
  delete(id: Uuid): Promise<void>;
}
