import { Request, Response, NextFunction } from "express";
import { Uuid } from "@wave-telecom/framework/core";
import { EducatorRepository } from "../../domain/repositories/educator-repository";
import { JwtAuthService } from "../services/auth-service-impl";

const authService = new JwtAuthService();

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
    const educatorId = await authService.verifyToken(token);

    if (!educatorId) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const educator = await educatorRepository.search({
      id: new Uuid(educatorId),
    });

    if (!educator || educator.length === 0) {
      return res.status(401).json({ message: "Educator not found" });
    }

    req.user = educator[0];
    next();
  };
}
