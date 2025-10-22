import bcrypt from "bcrypt";
import { failure, success } from "@wave-telecom/framework/core";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";

const SALT_ROUNDS = 10;

interface UpdatePasswordEducatorUseCaseRequest {
  email: string;
  newPassword: string;
}

export class UpdatePasswordEducatorUseCase {
    constructor(private educatorRepository: EducatorRepository) {}

    async execute(request: UpdatePasswordEducatorUseCaseRequest) {
        const educator = await this.educatorRepository.getByEmail(request.email);
        
        if (!educator) {
            return failure("EDUCATOR_NOT_FOUND");
        }

        const hash = await bcrypt.hash(request.newPassword, SALT_ROUNDS);

        educator.updatePassword(hash);

        await this.educatorRepository.save(educator);

        return success(void 0);

    }
}