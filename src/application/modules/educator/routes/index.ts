import { Request, Response, Router } from "express";
import { SignInEducatorUseCase } from "../use-cases/sign-in-educator/sign-in-educator-use-case";
import { RegisterEducatorUseCase } from "../use-cases/register-educator/register-educator-use-case";
import { SignInEducatorController } from "../use-cases/sign-in-educator/sign-in-educator-controller";
import { RegisterEducatorController } from "../use-cases/register-educator/register-educator-controller";
import { UpdatePasswordEducatorUseCase } from "../use-cases/update-password-educator/update-password-educator-use-case";
import { UpdatePasswordEducatorController } from "../use-cases/update-password-educator/update-password-educator-controller";
import { JwtAuthService } from "../../../../infraestructure/services/auth-service-impl";
import { NodemailerMailService } from "../../../../infraestructure/services/mail-service-impl";
import { GenerateAuthTokenUseCase } from "../use-cases/generate-auth-token/generate-auth-token-use-case";
import { GenerateAuthTokenController } from "../use-cases/generate-auth-token/generate-auth-token-controller";
import { VerifyTokenUseCase } from "../use-cases/verify-token/verify-token-use-case";
import { VerifyTokenController } from "../use-cases/verify-token/verify-token-controller";
import { ChangePasswordUseCase } from "../use-cases/change-password/change-password-use-case";
import { ChangePasswordController } from "../use-cases/change-password/change-password-controller";
import { GetEducatorProfileUseCase } from "../use-cases/get-educator-profile/get-educator-profile-use-case";
import { GetEducatorProfileController } from "../use-cases/get-educator-profile/get-educator-profile-controller";
import { makeAuthMiddleware } from "../../../../infraestructure/middlewares/index";
import {
  makeAuthTokenRepository,
  makeEducatorRepository,
  makeFileStorage,
  makeStudentRepository,
  makeTaskNotebookSessionRepository,
} from "../../../../infraestructure/factories";
import { GetEducatorLastSessionsUseCase } from "../use-cases/get-educator-last-sessions/get-educator-last-sessions-use-case";
import { GetEducatorLastSessionsController } from "../use-cases/get-educator-last-sessions/get-educator-last-sessions-controller";
import { EducatorUpdateProfilePictureUseCase } from "../use-cases/educator-update-profile-picture/educator-update-profile-picture-use-case";
import { Multer } from "../../../../infraestructure/upload/multer-config";
import { EducatorUpdateProfilePictureController } from "../use-cases/educator-update-profile-picture/educator-update-profile-picture-controller";
import { UpdateEducatorController } from "../use-cases/update-educator/update-educator-controller";
import { UpdateEducatorUseCase } from "../use-cases/update-educator/update-educator-use-case";

const educatorRouter = Router();

const educatorRepository = makeEducatorRepository({ isMock: false });
const studentRepository = makeStudentRepository({ isMock: false });
const taskNotebookSessionRepository = makeTaskNotebookSessionRepository();
const authTokenRepository = makeAuthTokenRepository({ isMock: false });

const authService = new JwtAuthService();

const authMiddleware = makeAuthMiddleware(educatorRepository);

const signInEducatorUseCase = new SignInEducatorUseCase(
  educatorRepository,
  authService
);

const registerEducatorUseCase = new RegisterEducatorUseCase(educatorRepository);
const updatePasswordEducatorUseCase = new UpdatePasswordEducatorUseCase(
  educatorRepository,
  authTokenRepository
);
const verifyTokenUseCase = new VerifyTokenUseCase(
  educatorRepository,
  authTokenRepository
);
const changePasswordUseCase = new ChangePasswordUseCase(
  educatorRepository,
  authService
);

const getEducatorProfileUseCase = new GetEducatorProfileUseCase(
  educatorRepository
);

const mailer = new NodemailerMailService();
const generateAuthTokenUseCase = new GenerateAuthTokenUseCase(
  educatorRepository,
  authTokenRepository,
  mailer
);

const updateEducatorUseCase = new UpdateEducatorUseCase(educatorRepository);

const getEducatorLastSessionsUseCase = new GetEducatorLastSessionsUseCase(
  educatorRepository,
  taskNotebookSessionRepository,
  studentRepository
);

const educatorUpdateProfilePicture = new EducatorUpdateProfilePictureUseCase(
  makeFileStorage(),
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

educatorRouter.put("/generate-token", async (req: Request, res: Response) => {
  new GenerateAuthTokenController(generateAuthTokenUseCase).execute(req, res);
});

educatorRouter.post("/verify-token", (req: Request, res: Response) => {
  new VerifyTokenController(verifyTokenUseCase).execute(req, res);
});

educatorRouter.put(
  "/change-password",
  authMiddleware,
  (req: Request, res: Response) => {
    new ChangePasswordController(changePasswordUseCase).execute(req, res);
  }
);

educatorRouter.get("/me", authMiddleware, (req: Request, res: Response) => {
  new GetEducatorProfileController(getEducatorProfileUseCase).execute(req, res);
});

educatorRouter.get(
  "/get-last-sessions",
  authMiddleware,
  (req: Request, res: Response) => {
    new GetEducatorLastSessionsController(
      getEducatorLastSessionsUseCase
    ).execute(req, res);
  }
);

educatorRouter.put(
  "/update-profile-picture",
  authMiddleware,
  Multer.getUploader(5).single("photo"),
  (req: Request, res: Response) => {
    new EducatorUpdateProfilePictureController(
      educatorUpdateProfilePicture
    ).execute(req, res);
  }
);

educatorRouter.put(
  "/update-educator",
  authMiddleware,
  (req: Request, res: Response) => {
    new UpdateEducatorController(updateEducatorUseCase).execute(req, res);
  }
);

export { educatorRouter };
