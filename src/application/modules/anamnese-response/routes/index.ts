import { Request, Response, Router } from "express";
import { makeAuthMiddleware } from "../../../../infraestructure/middlewares";
import {
  makeAnamneseTemplateRepository,
  makeAnamneseResponseRepository,
  makeStudentRepository,
  makeEducatorRepository,
} from "../../../../infraestructure/factories";
import { SubmitAnamneseResponseUseCase } from "../use-cases/submit-anamnese-response/submit-anamnese-response-use-case";
import { SubmitAnamneseResponseController } from "../use-cases/submit-anamnese-response/submit-anamnese-response-controller";
import { ListAnamneseResponsesByStudentUseCase } from "../use-cases/list-anamnese-responses-by-student/list-anamnese-responses-by-student-use-case";
import { ListAnamneseResponsesByStudentController } from "../use-cases/list-anamnese-responses-by-student/list-anamnese-responses-by-student-controller";
import { GetAnamneseResponseUseCase } from "../use-cases/get-anamnese-response/get-anamnese-response-use-case";
import { GetAnamneseResponseController } from "../use-cases/get-anamnese-response/get-anamnese-response-controller";

const anamneseResponseRouter = Router();

const educatorRepository = makeEducatorRepository({ isMock: false });
const studentRepository = makeStudentRepository({ isMock: false });
const templateRepository = makeAnamneseTemplateRepository();
const responseRepository = makeAnamneseResponseRepository();
const authMiddleware = makeAuthMiddleware(educatorRepository);

const submitUseCase = new SubmitAnamneseResponseUseCase(
  templateRepository,
  responseRepository,
  studentRepository
);

const listByStudentUseCase = new ListAnamneseResponsesByStudentUseCase(responseRepository);
const getUseCase = new GetAnamneseResponseUseCase(responseRepository);

anamneseResponseRouter.use(authMiddleware);

anamneseResponseRouter.post(
  "/templates/:templateId/responses",
  (req: Request, res: Response) => {
    new SubmitAnamneseResponseController(submitUseCase).execute(req, res);
  }
);

anamneseResponseRouter.get(
  "/responses/student/:studentId",
  (req: Request, res: Response) => {
    new ListAnamneseResponsesByStudentController(listByStudentUseCase).execute(req, res);
  }
);

anamneseResponseRouter.get(
  "/responses/:responseId",
  (req: Request, res: Response) => {
    new GetAnamneseResponseController(getUseCase).execute(req, res);
  }
);

export { anamneseResponseRouter };
