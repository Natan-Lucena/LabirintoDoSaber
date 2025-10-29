import { Educator } from "../../domain/entities/educator";

export interface generateTokenResponse {
  token: string;
}

export interface AuthService {
  generateToken(user: Educator): Promise<generateTokenResponse>;
  verifyToken(token: string): Promise<string | null>;
}
