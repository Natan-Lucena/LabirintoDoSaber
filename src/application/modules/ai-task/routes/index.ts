import { Request, Response, Router } from "express";
import { makeAuthMiddleware } from "../../../../infraestructure/middlewares";
import {
  makeAiTaskGeneratorService,
  makeEducatorRepository,
} from "../../../../infraestructure/factories";
import { GenerateTasksUseCase } from "../use-cases/generate-tasks/generate-tasks-use-case";
import { GenerateTasksController } from "../use-cases/generate-tasks/generate-tasks-controller";

const aiTaskRouter = Router();

const educatorRepository = makeEducatorRepository({ isMock: false });
const aiTaskGenerator = makeAiTaskGeneratorService();

const generateTasksUseCase = new GenerateTasksUseCase(aiTaskGenerator);

const authMiddleware = makeAuthMiddleware(educatorRepository);

aiTaskRouter.use(authMiddleware);

aiTaskRouter.post("/generate", (req: Request, res: Response) => {
  new GenerateTasksController(generateTasksUseCase).execute(req, res);
});

export { aiTaskRouter };
