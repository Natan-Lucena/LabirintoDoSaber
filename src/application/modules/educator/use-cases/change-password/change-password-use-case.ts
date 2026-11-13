import bcrypt from "bcrypt";
import { failure, success } from "@wave-telecom/framework/core";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { Educator } from "../../../../../domain/entities/educator";
import { AuthService } from "../../../../services/auth-service";

const SALT_ROUNDS = 10;

interface ChangePasswordUseCaseRequest {
  educator: Educator;
  currentPassword: string;
  newPassword: string;
}

// Troca de senha do educador logado. Os JWT emitidos antes deixam de valer, e
// um token novo é devolvido para a sessão atual continuar.
export class ChangePasswordUseCase {
  constructor(
    private educatorRepository: EducatorRepository,
    private authService: AuthService
  ) {}

  async execute(request: ChangePasswordUseCaseRequest) {
    const { educator } = request;

    if (!(await bcrypt.compare(request.currentPassword, educator.password))) {
      return failure("INVALID_CURRENT_PASSWORD");
    }

    if (await bcrypt.compare(request.newPassword, educator.password)) {
      return failure("PASSWORD_SAME_AS_OLD");
    }

    const hash = await bcrypt.hash(request.newPassword, SALT_ROUNDS);
    educator.updatePassword(hash, new Date());
    await this.educatorRepository.save(educator);

    // Assinado depois de gravar a troca, para não cair na invalidação.
    const { token } = await this.authService.generateToken(educator);

    return success({ token });
  }
}
