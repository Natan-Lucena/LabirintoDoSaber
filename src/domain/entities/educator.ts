import { failure, success, Uuid } from "@wave-telecom/framework/core";

interface CreateEducatorProps {
  id?: Uuid;
  createdAt?: Date;
  name: string;
  email: string;
  password: string;
  photoUrl?: string;
  contact?: string;
  profession?: string;
  passwordChangedAt?: Date;
}

interface UpdateEducatorProps {
  name?: string;
  contact?: string;
  profession?: string;
}

export class Educator {
  private constructor(
    public readonly id: Uuid,
    private _name: string,
    private _email: string,
    private _password: string,
    public readonly createdAt: Date,
    private _photoUrl?: string,
    private _contact?: string,
    private _profession?: string,
    private _passwordChangedAt?: Date
  ) {}

  static create(props: CreateEducatorProps) {
    return new Educator(
      props.id || Uuid.random(),
      props.name,
      props.email,
      props.password,
      props.createdAt || new Date(),
      props.photoUrl,
      props.contact,
      props.profession,
      props.passwordChangedAt
    );
  }

  get name(): string {
    return this._name;
  }

  get password(): string {
    return this._password;
  }

  get photoUrl(): string | undefined {
    return this._photoUrl;
  }

  get email(): string {
    return this._email;
  }

  get contact(): string | undefined {
    return this._contact;
  }

  get profession(): string | undefined {
    return this._profession;
  }

  get passwordChangedAt(): Date | undefined {
    return this._passwordChangedAt;
  }

  update(props: UpdateEducatorProps) {
    this._name = props.name ?? this._name;
    this._contact = props.contact ?? this._contact;
    this._profession = props.profession ?? this._profession;
  }

  updateProfilePicture(photoUrl: string) {
    this._photoUrl = photoUrl;
  }

  // Recebe o hash novo. A data da troca invalida os JWT emitidos antes dela.
  updatePassword(newPassword: string, changedAt: Date = new Date()) {
    if (this._password == newPassword) {
      return failure("PASSWORD_SAME_AS_OLD");
    }
    this._password = newPassword;
    this._passwordChangedAt = changedAt;
    return success(void 0);
  }
}
