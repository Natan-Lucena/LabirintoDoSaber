import { Educator } from "../../domain/entities/educator";

interface generateTokenResponse {
  token: string;
}

export interface AuthService {
  generateToken(user: Educator): Promise<generateTokenResponse>;
  verifyToken(token: string): Promise<Educator | null>;
}
