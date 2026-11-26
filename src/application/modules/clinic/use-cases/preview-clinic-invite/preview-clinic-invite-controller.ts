import { BaseController } from "@wave-telecom/framework/controllers";
import { Request, Response } from "express";
import { PreviewClinicInviteUseCase } from "./preview-clinic-invite-use-case";

// IP do cliente. Na Vercel, x-forwarded-for é preenchido pela plataforma (o
// primeiro valor é o cliente); localmente, cai no socket.
function clientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return first || req.socket.remoteAddress || "unknown";
}

// Rota pública: sem authMiddleware.
export class PreviewClinicInviteController extends BaseController {
  constructor(private useCase: PreviewClinicInviteUseCase) {
    super();
  }

  async executeImpl(req: Request, res: Response): Promise<unknown> {
    const result = await this.useCase.execute({
      code: String(req.params.code),
      ip: clientIp(req),
    });

    if (!result.ok) {
      switch (result.error) {
        case "INVITE_INVALID":
          return this.notFound(res, result.error);
        case "TOO_MANY_REQUESTS":
          return this.tooMany(res, result.error);
        default:
          return this.fail(res, "INTERNAL_SERVER_ERROR");
      }
    }

    const { clinicName, role, expiresAt } = result.value;
    return this.ok(res, { clinicName, role, expiresAt: expiresAt.toISOString() });
  }
}
