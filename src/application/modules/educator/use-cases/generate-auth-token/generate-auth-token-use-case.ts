import { failure, success } from "@wave-telecom/framework/core";
import { AuthTokenRepository } from "../../../../../domain/repositories/auth-token-repository";
import { MailService } from "../../../../services/mail-service";
import { EducatorRepository } from "../../../../../domain/repositories/educator-repository";
import { AuthToken } from "../../../../../domain/entities/auth-token";

const SUBJECT = "Código para redefinir sua senha";

function buildBody(name: string, code: string): string {
  return `
    <p>Olá, ${name}.</p>
    <p>Seu código para redefinir a senha no Labirinto do Saber é:</p>
    <p style="font-size: 24px; letter-spacing: 4px;"><strong>${code}</strong></p>
    <p>Ele vale por 15 minutos e só pode ser usado uma vez.</p>
    <p>Se você não pediu a troca de senha, ignore este e-mail. Sua senha continua a mesma.</p>
    <br/>
    <p>Equipe Labirinto do Saber</p>
  `;
}

export class GenerateAuthTokenUseCase {
  constructor(
    private educatorRepository: EducatorRepository,
    private authTokenRepository: AuthTokenRepository,
    private mailerService: MailService
  ) {}

  async execute(email: string) {
    const educator = await this.educatorRepository.getByEmail(email);

    // Mesma resposta para e-mail inexistente, para não revelar a conta.
    if (!educator) {
      return success(void 0);
    }

    const previous = await this.authTokenRepository.findByUserId(educator.id);

    const now = new Date();
    const issued = AuthToken.issue({ userId: educator.id, now, previous });

    if (!issued.ok) {
      return failure(issued.error);
    }

    const { authToken, code } = issued.value;

    // O código só vale se o envio coube na janela, contado de forma atômica:
    // pedidos em paralelo não passam do limite.
    if (!previous) {
      await this.authTokenRepository.create(authToken);
    } else if (!(await this.authTokenRepository.saveIssued(authToken, now))) {
      return failure("TOO_MANY_REQUESTS");
    }

    try {
      await this.mailerService.sendMail(
        educator.email,
        SUBJECT,
        buildBody(educator.name, code)
      );
    } catch (error) {
      // Só a mensagem do erro: nunca o código ou o corpo do e-mail.
      console.error(
        "Falha ao enviar o código de recuperação de senha:",
        error instanceof Error ? error.message : "erro desconhecido"
      );
    }

    return success(void 0);
  }
}
