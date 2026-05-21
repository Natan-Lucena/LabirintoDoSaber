import { Request, Response, Router } from "express";
import { makeAuthMiddleware } from "../../../../infraestructure/middlewares";
import {
  makeAnamneseTemplateRepository,
  makeAnamneseResponseRepository,
  makeEducatorRepository,
} from "../../../../infraestructure/factories";
import { CreateAnamneseTemplateUseCase } from "../use-cases/create-anamnese-template/create-anamnese-template-use-case";
import { CreateAnamneseTemplateController } from "../use-cases/create-anamnese-template/create-anamnese-template-controller";
import { GetAnamneseTemplateUseCase } from "../use-cases/get-anamnese-template/get-anamnese-template-use-case";
import { GetAnamneseTemplateController } from "../use-cases/get-anamnese-template/get-anamnese-template-controller";
import { ListAnamneseTemplatesUseCase } from "../use-cases/list-anamnese-templates/list-anamnese-templates-use-case";
import { ListAnamneseTemplatesController } from "../use-cases/list-anamnese-templates/list-anamnese-templates-controller";
import { UpdateAnamneseTemplateUseCase } from "../use-cases/update-anamnese-template/update-anamnese-template-use-case";
import { UpdateAnamneseTemplateController } from "../use-cases/update-anamnese-template/update-anamnese-template-controller";
import { DeleteAnamneseTemplateUseCase } from "../use-cases/delete-anamnese-template/delete-anamnese-template-use-case";
import { DeleteAnamneseTemplateController } from "../use-cases/delete-anamnese-template/delete-anamnese-template-controller";

const anamneseTemplateRouter = Router();

const educatorRepository = makeEducatorRepository({ isMock: false });
const templateRepository = makeAnamneseTemplateRepository();
const responseRepository = makeAnamneseResponseRepository();
const authMiddleware = makeAuthMiddleware(educatorRepository);

const createUseCase = new CreateAnamneseTemplateUseCase(templateRepository);
const getUseCase = new GetAnamneseTemplateUseCase(templateRepository);
const listUseCase = new ListAnamneseTemplatesUseCase(templateRepository);
const updateUseCase = new UpdateAnamneseTemplateUseCase(templateRepository, responseRepository);
const deleteUseCase = new DeleteAnamneseTemplateUseCase(templateRepository, responseRepository);

anamneseTemplateRouter.use(authMiddleware);

anamneseTemplateRouter.post("/", (req: Request, res: Response) => {
  new CreateAnamneseTemplateController(createUseCase).execute(req, res);
});

anamneseTemplateRouter.get("/", (req: Request, res: Response) => {
  new ListAnamneseTemplatesController(listUseCase).execute(req, res);
});

anamneseTemplateRouter.get("/:templateId", (req: Request, res: Response) => {
  new GetAnamneseTemplateController(getUseCase).execute(req, res);
});

anamneseTemplateRouter.put("/:templateId", (req: Request, res: Response) => {
  new UpdateAnamneseTemplateController(updateUseCase).execute(req, res);
});

anamneseTemplateRouter.delete("/:templateId", (req: Request, res: Response) => {
  new DeleteAnamneseTemplateController(deleteUseCase).execute(req, res);
});

export { anamneseTemplateRouter };
