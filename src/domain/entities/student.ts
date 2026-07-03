import { Uuid } from "@wave-telecom/framework/core";
import { Educator } from "./educator";

export enum Gender {
  Male = "male",
  Female = "female",
}

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
    public readonly educatorId: Uuid,
    private _photoUrl?: string,
    private _documents: StudentDocument[] = []
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
      props.documents ?? []
    );
  }

  assignEducator(educator: Educator) {
    this.educators.push(educator);
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
}
