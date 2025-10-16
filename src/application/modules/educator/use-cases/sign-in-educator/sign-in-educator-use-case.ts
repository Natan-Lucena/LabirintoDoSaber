import bcrypt from "bcrypt";
import { failure } from "@wave-telecom/framework/core";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { AuthService } from "../../../../services/auth-service";

interface SignInEducatorUseCaseRequest {
  email: string;
  password: string;
}

export class SignInEducatorUseCase {
  constructor(
    private educatorRepository: EducatorRepository,
    private authService: AuthService
  ) {}

  async execute(request: SignInEducatorUseCaseRequest) {
    const educator = await this.educatorRepository.getByEmail(request.email);
    if (!educator) {
      return failure("INVALID_CREDENTIALS");
    }

    const isPasswordValid = await bcrypt.compare(
      request.password,
      educator.password
    );
    if (!isPasswordValid) {
      return failure("INVALID_CREDENTIALS");
    }

    const token = await this.authService.generateToken(educator);
    return { token };
  }
}
