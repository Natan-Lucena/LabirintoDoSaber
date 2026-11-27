import { Router } from "express";
import {
  makeActivityResultRepository,
  makeAiClinicalService,
  makeEducatorRepository,
  makePlanRepository,
  makeSessionEvolutionRepository,
  makeStudentAccessService,
  makeStudentRepository,
  makeTaskNotebookSessionRepository,
  makeTaskRepository,
} from "../../../../infraestructure/factories";
import { makeAuthMiddleware } from "../../../../infraestructure/middlewares";
import { GetEvolutionContextUseCase } from "../use-cases/get-evolution-context/get-evolution-context-use-case";
import { GetEvolutionContextController } from "../use-cases/get-evolution-context/get-evolution-context-controller";
import { CreateSessionEvolutionUseCase } from "../use-cases/create-session-evolution/create-session-evolution-use-case";
import { CreateSessionEvolutionController } from "../use-cases/create-session-evolution/create-session-evolution-controller";
import { ListSessionEvolutionsUseCase } from "../use-cases/list-session-evolutions/list-session-evolutions-use-case";
import { ListSessionEvolutionsController } from "../use-cases/list-session-evolutions/list-session-evolutions-controller";
import { GetSessionEvolutionUseCase } from "../use-cases/get-session-evolution/get-session-evolution-use-case";
import { GetSessionEvolutionController } from "../use-cases/get-session-evolution/get-session-evolution-controller";
import { UpdateSessionEvolutionUseCase } from "../use-cases/update-session-evolution/update-session-evolution-use-case";
import { UpdateSessionEvolutionController } from "../use-cases/update-session-evolution/update-session-evolution-controller";
import { ListPendingEvolutionsUseCase } from "../use-cases/list-pending-evolutions/list-pending-evolutions-use-case";
import { ListPendingEvolutionsController } from "../use-cases/list-pending-evolutions/list-pending-evolutions-controller";
import { NextSessionSuggestionUseCase } from "../use-cases/next-session-suggestion/next-session-suggestion-use-case";
import { NextSessionSuggestionController } from "../use-cases/next-session-suggestion/next-session-suggestion-controller";

const sessionEvolutionRouter = Router();

const educatorRepository = makeEducatorRepository({ isMock: false });
const studentRepository = makeStudentRepository({ isMock: false });
const studentAccess = makeStudentAccessService();
const sessionRepository = makeTaskNotebookSessionRepository();
const planRepository = makePlanRepository();
const evolutionRepository = makeSessionEvolutionRepository();
const aiClinicalService = makeAiClinicalService();
const activityResultRepository = makeActivityResultRepository();
const taskRepository = makeTaskRepository({ isMock: false });

const getEvolutionContextUseCase = new GetEvolutionContextUseCase(
  sessionRepository,
  studentAccess,
  planRepository,
  evolutionRepository,
  activityResultRepository,
  taskRepository
);
const createSessionEvolutionUseCase = new CreateSessionEvolutionUseCase(
  sessionRepository,
  studentAccess,
  planRepository,
  evolutionRepository
);
const listSessionEvolutionsUseCase = new ListSessionEvolutionsUseCase(
  evolutionRepository,
  studentAccess,
  educatorRepository
);
const getSessionEvolutionUseCase = new GetSessionEvolutionUseCase(
  evolutionRepository,
  studentAccess,
  educatorRepository
);
const updateSessionEvolutionUseCase = new UpdateSessionEvolutionUseCase(
  evolutionRepository,
  studentAccess,
  planRepository,
  sessionRepository
);
const listPendingEvolutionsUseCase = new ListPendingEvolutionsUseCase(
  sessionRepository,
  evolutionRepository,
  studentRepository,
  studentAccess
);
const nextSessionSuggestionUseCase = new NextSessionSuggestionUseCase(
  sessionRepository,
  studentAccess,
  planRepository,
  evolutionRepository,
  aiClinicalService
);

const authMiddleware = makeAuthMiddleware(educatorRepository);

sessionEvolutionRouter.use(authMiddleware);

sessionEvolutionRouter.post("/", async (req, res) => {
  new CreateSessionEvolutionController(createSessionEvolutionUseCase).execute(req, res);
});

sessionEvolutionRouter.get("/", async (req, res) => {
  new ListSessionEvolutionsController(listSessionEvolutionsUseCase).execute(req, res);
});

// Rotas literais antes de /:id.
sessionEvolutionRouter.get("/context/:sessionId", async (req, res) => {
  new GetEvolutionContextController(getEvolutionContextUseCase).execute(req, res);
});

sessionEvolutionRouter.post("/next-session-suggestion", async (req, res) => {
  new NextSessionSuggestionController(nextSessionSuggestionUseCase).execute(req, res);
});

sessionEvolutionRouter.get("/pending", async (req, res) => {
  new ListPendingEvolutionsController(listPendingEvolutionsUseCase).execute(req, res);
});

sessionEvolutionRouter.get("/:id", async (req, res) => {
  new GetSessionEvolutionController(getSessionEvolutionUseCase).execute(req, res);
});

sessionEvolutionRouter.put("/:id", async (req, res) => {
  new UpdateSessionEvolutionController(updateSessionEvolutionUseCase).execute(req, res);
});

export { sessionEvolutionRouter };
