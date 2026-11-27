import { Router } from "express";
import {
  makeEducatorRepository,
  makeHelpTutorialRepository,
} from "../../../../infraestructure/factories";
import { makeAuthMiddleware } from "../../../../infraestructure/middlewares";
import { ListHelpTutorialsUseCase } from "../use-cases/list-help-tutorials/list-help-tutorials-use-case";
import { ListHelpTutorialsController } from "../use-cases/list-help-tutorials/list-help-tutorials-controller";

const helpRouter = Router();

const authMiddleware = makeAuthMiddleware(makeEducatorRepository({ isMock: false }));
const listHelpTutorialsUseCase = new ListHelpTutorialsUseCase(makeHelpTutorialRepository());

helpRouter.use(authMiddleware);

helpRouter.get("/tutorials", async (req, res) => {
  new ListHelpTutorialsController(listHelpTutorialsUseCase).execute(req, res);
});

export { helpRouter };
