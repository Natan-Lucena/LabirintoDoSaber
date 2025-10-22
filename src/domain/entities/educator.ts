import { Uuid } from "@wave-telecom/framework/core";

interface CreateEducatorProps {
  id?: Uuid;
  createdAt?: Date;
  name: string;
  email: string;
  password: string;
}

export class Educator {
  private constructor(
    public readonly id: Uuid,
    public readonly name: string,
    public readonly email: string,
    public password: string,
    public readonly createdAt: Date
  ) {}

  static create(props: CreateEducatorProps) {
    return new Educator(
      props.id || Uuid.random(),
      props.name,
      props.email,
      props.password,
      props.createdAt || new Date()
    );
  }

  updatePassword(newPassword: string): void {
    if(this.password == newPassword) {
      throw new Error("PASSWORD_SAME_AS_OLD");
    }
    this.password = newPassword;
  }
}
