import { Request, Response, Router } from "express";
import { MockEducatorRepository } from "../../../../infraestructure/repositories/mock/educator-repository-impl";
import { MockAuthService } from "../../../../infraestructure/services/auth-service-impl";
import { SignInEducatorUseCase } from "../use-cases/sign-in-educator/sign-in-educator-use-case";
import { RegisterEducatorUseCase } from "../use-cases/register-educator/register-educator-use-case";
import { SignInEducatorController } from "../use-cases/sign-in-educator/sign-in-educator-controller";
import { RegisterEducatorController } from "../use-cases/register-educator/register-educator-controller";

const educatorRouter = Router();

const educatorRepository = new MockEducatorRepository();
const authService = new MockAuthService();

const signInEducatorUseCase = new SignInEducatorUseCase(
  educatorRepository,
  authService
);

const registerEducatorUseCase = new RegisterEducatorUseCase(educatorRepository);

educatorRouter.post("sign-in", (req: Request, res: Response) => {
  new SignInEducatorController(signInEducatorUseCase).execute(req, res);
});

educatorRouter.post("register", (req: Request, res: Response) => {
  new RegisterEducatorController(registerEducatorUseCase).execute(req, res);
});

export { educatorRouter };
