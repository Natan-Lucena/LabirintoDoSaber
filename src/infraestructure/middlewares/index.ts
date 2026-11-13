import { Request, Response, NextFunction } from "express";
import { Uuid } from "@wave-telecom/framework/core";
import { EducatorRepository } from "../../domain/repositories/educator-repository";
import { JwtAuthService } from "../services/auth-service-impl";
import multer from "multer";
import { timingSafeEqual } from "crypto";

export function requireJobApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (req.headers["x-job-api-key"] !== process.env.INTERNAL_JOB_API_KEY) {
    res.sendStatus(401);
    return;
  }
  next();
}

// Cron da Vercel: envia `Authorization: Bearer <CRON_SECRET>`. Sem o segredo
// configurado, recusa sempre.
export function requireCronSecret(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const secret = process.env.CRON_SECRET;
  const expected = Buffer.from(`Bearer ${secret ?? ""}`);
  const received = Buffer.from(req.headers.authorization ?? "");
  // Comparação em tempo constante; timingSafeEqual exige o mesmo tamanho.
  const valid =
    !!secret &&
    received.length === expected.length &&
    timingSafeEqual(received, expected);
  if (!valid) {
    res.sendStatus(401);
    return;
  }
  next();
}

const authService = new JwtAuthService();

// Token emitido antes da última troca de senha deixa de valer. O `iat` do JWT
// é em segundos: um token emitido no mesmo segundo da troca continua válido.
function issuedBeforePasswordChange(
  iatSeconds: number,
  passwordChangedAt?: Date
): boolean {
  if (!passwordChangedAt) return false;
  return iatSeconds < Math.floor(passwordChangedAt.getTime() / 1000);
}

export function makeAuthMiddleware(educatorRepository: EducatorRepository) {
  return async function authMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Missing or invalid token" });
    }

    const token = authHeader.split(" ")[1];
    const verified = await authService.verifyToken(token);

    if (!verified) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const educator = await educatorRepository.search({
      id: new Uuid(verified.id),
    });

    if (!educator || educator.length === 0) {
      return res.status(401).json({ message: "Educator not found" });
    }

    if (issuedBeforePasswordChange(verified.iat, educator[0].passwordChangedAt)) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    req.user = educator[0];
    next();
  };
}

export const multerErrorHandlerMiddleware = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        message: "THIS FILE IS TO LARGE",
      });
    }
  }

  next(err);
};
