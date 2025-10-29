import { Request, Response, Router } from "express";
import { MockEducatorRepository } from "../../../../infraestructure/repositories/mock/educator-repository-impl";
import { SignInEducatorUseCase } from "../use-cases/sign-in-educator/sign-in-educator-use-case";
import { RegisterEducatorUseCase } from "../use-cases/register-educator/register-educator-use-case";
import { SignInEducatorController } from "../use-cases/sign-in-educator/sign-in-educator-controller";
import { RegisterEducatorController } from "../use-cases/register-educator/register-educator-controller";
import { UpdatePasswordEducatorUseCase } from "../use-cases/update-password-educator/update-password-educator-use-case";
import { UpdatePasswordEducatorController } from "../use-cases/update-password-educator/update-password-educator-controller";
import { JwtAuthService } from "../../../../infraestructure/services/auth-service-impl";

const educatorRouter = Router();

const educatorRepository = new MockEducatorRepository();
const authService = new JwtAuthService();

const signInEducatorUseCase = new SignInEducatorUseCase(
  educatorRepository,
  authService
);

const registerEducatorUseCase = new RegisterEducatorUseCase(educatorRepository);
const updatePasswordEducatorUseCase = new UpdatePasswordEducatorUseCase(
  educatorRepository
);

educatorRouter.post("/sign-in", (req: Request, res: Response) => {
  new SignInEducatorController(signInEducatorUseCase).execute(req, res);
});

educatorRouter.post("/register", (req: Request, res: Response) => {
  new RegisterEducatorController(registerEducatorUseCase).execute(req, res);
});

educatorRouter.post("/update-password", async (req: Request, res: Response) => {
  new UpdatePasswordEducatorController(updatePasswordEducatorUseCase).execute(
    req,
    res
  );
});

export { educatorRouter };
