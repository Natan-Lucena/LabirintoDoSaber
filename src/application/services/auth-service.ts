import { Educator } from "../../domain/entities/educator";

export interface generateTokenResponse {
  token: string;
}

export interface VerifiedToken {
  id: string;
  // Emissão do token, em segundos (claim `iat` do JWT).
  iat: number;
}

export interface AuthService {
  generateToken(user: Educator): Promise<generateTokenResponse>;
  verifyToken(token: string): Promise<VerifiedToken | null>;
}
