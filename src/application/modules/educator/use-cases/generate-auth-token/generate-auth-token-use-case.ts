import { failure, success, Uuid } from "@wave-telecom/framework/core";
import { AuthTokenRepository } from "../../../../../domain/repositories/auth-token-repository";
import { MailService } from "../../../../services/mail-service";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { AuthToken } from "../../../../../domain/entities/auth-token";

export class GenerateAuthTokenUseCase {
  constructor(
    private educatorRepository: EducatorRepository,
    private authTokenRepository: AuthTokenRepository,
    private mailerService: MailService
  ) {}

  async execute(educatorEmail: string) {
    const educator = await this.educatorRepository.search({
      email: educatorEmail,
    });
    if (!educator || educator.length === 0) {
      return failure("EDUCATOR_NOT_FOUND");
    }

    const tokenAlreadyExists = await this.authTokenRepository.findByUserId(
      educator[0].id
    );

    const subject = "Your Authentication Token";

    if (tokenAlreadyExists) {
      tokenAlreadyExists.generateNewToken();
      await this.authTokenRepository.update(tokenAlreadyExists);
      const body = `
      <p>Dear ${educator[0].name},</p>
      <p>Your new authentication token is: <strong>${tokenAlreadyExists.token}</strong></p>
        <p>Please use this token to access your account.</p>
        <br/>
        <p>Best regards,<br/>Labirinto do Saber Team</p>
    `;

      await this.mailerService.sendMail(educator[0].email, subject, body);
      return success(void 0);
    }
    const authToken = AuthToken.create(educator[0].id);
    await this.authTokenRepository.create(authToken);
    const body = `
      <p>Dear ${educator[0].name},</p>
      <p>Your authentication token is: <strong>${authToken.token}</strong></p>
      <p>Please use this token to access your account.</p>
      <br/>
      <p>Best regards,<br/>Labirinto do Saber Team</p>
    `;

    await this.mailerService.sendMail(educator[0].email, subject, body);

    return success(void 0);
  }
}
