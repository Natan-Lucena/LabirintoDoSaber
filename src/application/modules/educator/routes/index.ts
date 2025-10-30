import { Request, Response, Router } from "express";
import { MockEducatorRepository } from "../../../../infraestructure/repositories/mock/educator-repository-impl";
import { SignInEducatorUseCase } from "../use-cases/sign-in-educator/sign-in-educator-use-case";
import { RegisterEducatorUseCase } from "../use-cases/register-educator/register-educator-use-case";
import { SignInEducatorController } from "../use-cases/sign-in-educator/sign-in-educator-controller";
import { RegisterEducatorController } from "../use-cases/register-educator/register-educator-controller";
import { UpdatePasswordEducatorUseCase } from "../use-cases/update-password-educator/update-password-educator-use-case";
import { UpdatePasswordEducatorController } from "../use-cases/update-password-educator/update-password-educator-controller";
import { JwtAuthService } from "../../../../infraestructure/services/auth-service-impl";
import { NodemailerMailService } from "../../../../infraestructure/services/mail-service-impl";
import { GenerateAuthTokenUseCase } from "../use-cases/generate-auth-token/generate-auth-token-use-case";
import { MockAuthTokenRepository } from "../../../../infraestructure/repositories/mock/auth-token-repository-impl";
import { GenerateAuthTokenController } from "../use-cases/generate-auth-token/generate-auth-token-controller";

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

const authTokenRepository = new MockAuthTokenRepository();
const mailer = new NodemailerMailService();
const generateAuthTokenUseCase = new GenerateAuthTokenUseCase(
  educatorRepository,
  authTokenRepository,
  mailer
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

educatorRouter.put("/generate-token", async (req: Request, res: Response) => {
  new GenerateAuthTokenController(generateAuthTokenUseCase).execute(req, res);
});

export { educatorRouter };
