import { Uuid } from "@wave-telecom/framework/core";
import { Educator } from "./educator";

export enum Gender {
  Male = "male",
  Female = "female",
}

// PA-01: registro sem status gravado é ACTIVE.
export type StudentStatus = "ACTIVE" | "ARCHIVED";
export const STUDENT_STATUSES: StudentStatus[] = ["ACTIVE", "ARCHIVED"];

export interface StudentDocument {
  id: string;
  name: string;
  url: string;
  uploadedAt: Date;
}

export interface UpdateStudentProps {
  name?: string;
  age?: number;
  gender?: Gender;
  zipcode?: string;
  road?: string;
  housenumber?: string;
  phonenumber?: string;
  learningTopics?: string[];
  // PP-05: null apaga; ausente mantém.
  guardianName?: string | null;
  guardianPhone?: string | null;
  guardianRelationship?: string | null;
}

export interface CreateStudentProps {
  id?: Uuid;
  createdAt?: Date;
  name: string;
  age: number;
  gender: Gender;
  zipcode: string;
  road: string;
  housenumber: string;
  phonenumber: string;
  learningTopics: string[];
  educators: Educator[];
  educatorId: Uuid;
  photoUrl?: string;
  documents?: StudentDocument[];
  guardianName?: string;
  guardianPhone?: string;
  guardianRelationship?: string;
  status?: StudentStatus;
  archivedAt?: Date;
}

export class Student {
  private constructor(
    public readonly id: Uuid,
    private _name: string,
    private _age: number,
    private _gender: Gender,
    private _zipcode: string,
    private _road: string,
    private _housenumber: string,
    private _phonenumber: string,
    private _learningTopics: string[],
    public readonly createdAt: Date,
    public readonly educators: Educator[],
    private _educatorId: Uuid,
    private _photoUrl?: string,
    private _documents: StudentDocument[] = [],
    private _guardianName?: string,
    private _guardianPhone?: string,
    private _guardianRelationship?: string,
    private _status: StudentStatus = "ACTIVE",
    private _archivedAt?: Date
  ) {}

  static create(props: CreateStudentProps) {
    return new Student(
      props.id || Uuid.random(),
      props.name,
      props.age,
      props.gender,
      props.zipcode,
      props.road,
      props.housenumber,
      props.phonenumber,
      props.learningTopics,
      props.createdAt || new Date(),
      props.educators,
      props.educatorId,
      props.photoUrl,
      props.documents ?? [],
      props.guardianName,
      props.guardianPhone,
      props.guardianRelationship,
      props.status ?? "ACTIVE",
      props.archivedAt
    );
  }

  assignEducator(educator: Educator) {
    this.educators.push(educator);
  }

  // Transfere o paciente: o novo educador passa a ser o dono.
  transferTo(educatorId: Uuid) {
    this._educatorId = educatorId;
  }

  get educatorId(): Uuid {
    return this._educatorId;
  }

  updatePhoto(photoUrl: string) {
    this._photoUrl = photoUrl;
  }

  addDocument(document: StudentDocument) {
    this._documents.push(document);
  }

  update(props: UpdateStudentProps) {
    this._name = props.name ?? this._name;
    this._age = props.age ?? this._age;
    this._gender = props.gender ?? this._gender;
    this._zipcode = props.zipcode ?? this._zipcode;
    this._road = props.road ?? this._road;
    this._housenumber = props.housenumber ?? this._housenumber;
    this._phonenumber = props.phonenumber ?? this._phonenumber;
    this._learningTopics = props.learningTopics
      ? [...props.learningTopics]
      : this._learningTopics;
    this._guardianName = nullClears(props.guardianName, this._guardianName);
    this._guardianPhone = nullClears(props.guardianPhone, this._guardianPhone);
    this._guardianRelationship = nullClears(
      props.guardianRelationship,
      this._guardianRelationship
    );
  }

  // PA-02. Arquivar de novo mantém a data original.
  archive(now: Date) {
    if (this._status === "ARCHIVED") return;
    this._status = "ARCHIVED";
    this._archivedAt = now;
  }

  // PA-05: volta a ACTIVE sem recriar nada do que foi cancelado.
  reactivate() {
    this._status = "ACTIVE";
    this._archivedAt = undefined;
  }

  get status(): StudentStatus {
    return this._status;
  }

  get isArchived(): boolean {
    return this._status === "ARCHIVED";
  }

  get archivedAt(): Date | undefined {
    return this._archivedAt;
  }

  get photoUrl(): string | undefined {
    return this._photoUrl;
  }

  get documents(): StudentDocument[] {
    return this._documents;
  }

  get name(): string {
    return this._name;
  }

  // Só o primeiro nome, para textos curtos como as notificações.
  get firstName(): string {
    return this._name.trim().split(/\s+/)[0];
  }

  get age(): number {
    return this._age;
  }

  get gender(): Gender {
    return this._gender;
  }

  get zipcode(): string {
    return this._zipcode;
  }

  get road(): string {
    return this._road;
  }

  get housenumber(): string {
    return this._housenumber;
  }

  get phonenumber(): string {
    return this._phonenumber;
  }

  get learningTopics(): string[] {
    return this._learningTopics;
  }

  get guardianName(): string | undefined {
    return this._guardianName;
  }

  get guardianPhone(): string | undefined {
    return this._guardianPhone;
  }

  get guardianRelationship(): string | undefined {
    return this._guardianRelationship;
  }
}

// null apaga, undefined mantém o valor atual.
function nullClears(value: string | null | undefined, current: string | undefined) {
  return value === null ? undefined : (value ?? current);
}
