import { Educator } from "../../domain/entities/educator";

declare global {
  namespace Express {
    interface Request {
      user?: Educator;
    }
  }
}
