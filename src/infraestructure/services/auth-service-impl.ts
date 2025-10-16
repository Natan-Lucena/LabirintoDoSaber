import {
  AuthService,
  generateTokenResponse,
} from "../../application/services/auth-service";
import { Educator } from "../../domain/entities/educator";

export class MockAuthService implements AuthService {
  generateToken(user: Educator): Promise<generateTokenResponse> {
    return Promise.resolve({ token: "mock-token" });
  }
  verifyToken(token: string): Promise<Educator | null> {
    return Promise.resolve(null);
  }
}
