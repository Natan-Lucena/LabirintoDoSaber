import { Router } from "express";
import {
  makeEducatorRepository,
  makeScaleTemplateRepository,
} from "../../../../infraestructure/factories";
import { makeAuthMiddleware } from "../../../../infraestructure/middlewares";
import { ListScaleTemplatesUseCase } from "../use-cases/list-scale-templates/list-scale-templates-use-case";
import { ListScaleTemplatesController } from "../use-cases/list-scale-templates/list-scale-templates-controller";
import { GetScaleTemplateUseCase } from "../use-cases/get-scale-template/get-scale-template-use-case";
import { GetScaleTemplateController } from "../use-cases/get-scale-template/get-scale-template-controller";

const scaleTemplateRouter = Router();

const educatorRepository = makeEducatorRepository({ isMock: false });
const templateRepository = makeScaleTemplateRepository();

const listScaleTemplatesUseCase = new ListScaleTemplatesUseCase(templateRepository);
const getScaleTemplateUseCase = new GetScaleTemplateUseCase(templateRepository);

const authMiddleware = makeAuthMiddleware(educatorRepository);

scaleTemplateRouter.use(authMiddleware);

scaleTemplateRouter.get("/", async (req, res) => {
  new ListScaleTemplatesController(listScaleTemplatesUseCase).execute(req, res);
});

scaleTemplateRouter.get("/:id", async (req, res) => {
  new GetScaleTemplateController(getScaleTemplateUseCase).execute(req, res);
});

export { scaleTemplateRouter };
