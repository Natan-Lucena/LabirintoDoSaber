import bcrypt from "bcrypt";
import { failure, success } from "@wave-telecom/framework/core";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { Educator } from "../../../../../domain/entities/educator";

const SALT_ROUNDS = 10;

interface RegisterEducatorUseCaseRequest {
  name: string;
  email: string;
  password: string;
}

export class RegisterEducatorUseCase {
  constructor(private educatorRepository: EducatorRepository) {}

  async execute(props: RegisterEducatorUseCaseRequest) {
    const userAlreadyExists = await this.educatorRepository.getByEmail(
      props.email
    );

    if (userAlreadyExists) {
      return failure("EDUCATOR_ALREADY_EXISTS");
    }

    const hash = await bcrypt.hash(props.password, SALT_ROUNDS);

    const educator = Educator.create({
      name: props.name,
      email: props.email,
      password: hash,
    });

    await this.educatorRepository.save(educator);

    return success(void 0);
  }
}
