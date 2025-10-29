import jwt from "jsonwebtoken";
import {
  AuthService,
  generateTokenResponse,
} from "../../application/services/auth-service";
import { Educator } from "../../domain/entities/educator";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";
const JWT_EXPIRES_IN = "7d";

interface JwtPayload {
  id: string;
}

export class JwtAuthService implements AuthService {
  async generateToken(user: Educator): Promise<generateTokenResponse> {
    const payload: JwtPayload = { id: user.id.value };

    const token = jwt.sign(payload, JWT_SECRET, {
      expiresIn: JWT_EXPIRES_IN,
    });

    return { token };
  }

  async verifyToken(token: string): Promise<string | null> {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;
      return decoded.id;
    } catch {
      return null;
    }
  }
}
