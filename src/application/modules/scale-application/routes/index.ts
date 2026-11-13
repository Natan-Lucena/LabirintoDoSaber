import { Router } from "express";
import {
  makeAiClinicalService,
  makeAppointmentRepository,
  makeEducatorRepository,
  makeScaleApplicationRepository,
  makeScaleTemplateRepository,
  makeStudentRepository,
} from "../../../../infraestructure/factories";
import { makeAuthMiddleware } from "../../../../infraestructure/middlewares";
import { StartScaleApplicationUseCase } from "../use-cases/start-scale-application/start-scale-application-use-case";
import { StartScaleApplicationController } from "../use-cases/start-scale-application/start-scale-application-controller";
import { ListScaleApplicationsUseCase } from "../use-cases/list-scale-applications/list-scale-applications-use-case";
import { ListScaleApplicationsController } from "../use-cases/list-scale-applications/list-scale-applications-controller";
import { GetScaleApplicationUseCase } from "../use-cases/get-scale-application/get-scale-application-use-case";
import { GetScaleApplicationController } from "../use-cases/get-scale-application/get-scale-application-controller";
import { SaveScaleAnswersUseCase } from "../use-cases/save-scale-answers/save-scale-answers-use-case";
import { SaveScaleAnswersController } from "../use-cases/save-scale-answers/save-scale-answers-controller";
import { CompleteScaleApplicationUseCase } from "../use-cases/complete-scale-application/complete-scale-application-use-case";
import { CompleteScaleApplicationController } from "../use-cases/complete-scale-application/complete-scale-application-controller";
import { DeleteScaleApplicationUseCase } from "../use-cases/delete-scale-application/delete-scale-application-use-case";
import { DeleteScaleApplicationController } from "../use-cases/delete-scale-application/delete-scale-application-controller";
import { GenerateInsightUseCase } from "../use-cases/generate-insight/generate-insight-use-case";
import { GenerateInsightController } from "../use-cases/generate-insight/generate-insight-controller";

const scaleApplicationRouter = Router();

const educatorRepository = makeEducatorRepository({ isMock: false });
const studentRepository = makeStudentRepository({ isMock: false });
const appointmentRepository = makeAppointmentRepository();
const templateRepository = makeScaleTemplateRepository();
const applicationRepository = makeScaleApplicationRepository();

const startScaleApplicationUseCase = new StartScaleApplicationUseCase(
  applicationRepository,
  templateRepository,
  studentRepository,
  appointmentRepository
);
const listScaleApplicationsUseCase = new ListScaleApplicationsUseCase(
  applicationRepository,
  templateRepository,
  studentRepository
);
const getScaleApplicationUseCase = new GetScaleApplicationUseCase(
  applicationRepository,
  templateRepository,
  studentRepository
);
const saveScaleAnswersUseCase = new SaveScaleAnswersUseCase(
  applicationRepository,
  templateRepository,
  studentRepository
);
const completeScaleApplicationUseCase = new CompleteScaleApplicationUseCase(
  applicationRepository,
  templateRepository,
  studentRepository
);
const deleteScaleApplicationUseCase = new DeleteScaleApplicationUseCase(
  applicationRepository,
  studentRepository
);
const generateInsightUseCase = new GenerateInsightUseCase(
  applicationRepository,
  templateRepository,
  studentRepository,
  makeAiClinicalService()
);

const authMiddleware = makeAuthMiddleware(educatorRepository);

scaleApplicationRouter.use(authMiddleware);

scaleApplicationRouter.post("/", async (req, res) => {
  new StartScaleApplicationController(startScaleApplicationUseCase).execute(req, res);
});

scaleApplicationRouter.get("/", async (req, res) => {
  new ListScaleApplicationsController(listScaleApplicationsUseCase).execute(req, res);
});

// Rotas com sufixo antes das de /:id.
scaleApplicationRouter.put("/:id/answers", async (req, res) => {
  new SaveScaleAnswersController(saveScaleAnswersUseCase).execute(req, res);
});

scaleApplicationRouter.post("/:id/complete", async (req, res) => {
  new CompleteScaleApplicationController(completeScaleApplicationUseCase).execute(req, res);
});

scaleApplicationRouter.post("/:id/insight", async (req, res) => {
  new GenerateInsightController(generateInsightUseCase).execute(req, res);
});

scaleApplicationRouter.get("/:id", async (req, res) => {
  new GetScaleApplicationController(getScaleApplicationUseCase).execute(req, res);
});

scaleApplicationRouter.delete("/:id", async (req, res) => {
  new DeleteScaleApplicationController(deleteScaleApplicationUseCase).execute(req, res);
});

export { scaleApplicationRouter };
