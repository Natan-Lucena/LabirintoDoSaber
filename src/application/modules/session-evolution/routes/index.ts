import { Router } from "express";
import {
  makeAiClinicalService,
  makeEducatorRepository,
  makePlanRepository,
  makeSessionEvolutionRepository,
  makeStudentRepository,
  makeTaskNotebookSessionRepository,
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
const sessionRepository = makeTaskNotebookSessionRepository();
const planRepository = makePlanRepository();
const evolutionRepository = makeSessionEvolutionRepository();
const aiClinicalService = makeAiClinicalService();

const getEvolutionContextUseCase = new GetEvolutionContextUseCase(
  sessionRepository,
  studentRepository,
  planRepository,
  evolutionRepository
);
const createSessionEvolutionUseCase = new CreateSessionEvolutionUseCase(
  sessionRepository,
  studentRepository,
  planRepository,
  evolutionRepository
);
const listSessionEvolutionsUseCase = new ListSessionEvolutionsUseCase(
  evolutionRepository,
  studentRepository
);
const getSessionEvolutionUseCase = new GetSessionEvolutionUseCase(
  evolutionRepository,
  studentRepository
);
const updateSessionEvolutionUseCase = new UpdateSessionEvolutionUseCase(
  evolutionRepository,
  studentRepository,
  planRepository,
  sessionRepository
);
const listPendingEvolutionsUseCase = new ListPendingEvolutionsUseCase(
  sessionRepository,
  evolutionRepository,
  studentRepository
);
const nextSessionSuggestionUseCase = new NextSessionSuggestionUseCase(
  sessionRepository,
  studentRepository,
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
