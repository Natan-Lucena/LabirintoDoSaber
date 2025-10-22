import { Uuid } from "@wave-telecom/framework/core";

interface CreateEducatorProps {
  id?: Uuid;
  createdAt?: Date;
  name: string;
  email: string;
  password: string;
}

export class Educator {
  private _password: string;

  private constructor(
    public readonly id: Uuid,
    public readonly name: string,
    public readonly email: string,
    password: string,
    public readonly createdAt: Date
  ) {
    this._password = password;
  }

  static create(props: CreateEducatorProps) {
    return new Educator(
      props.id || Uuid.random(),
      props.name,
      props.email,
      props.password,
      props.createdAt || new Date()
    );
  }

  get password(): string {
    return this._password;
  }

  updatePassword(newPassword: string): void {
    if(this._password == newPassword) {
      throw new Error("PASSWORD_SAME_AS_OLD");
    }
    this._password = newPassword;
  }
}
