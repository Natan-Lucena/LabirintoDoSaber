import { Router } from "express";
import {
  makeAiClinicalService,
  makeAnamneseResponseRepository,
  makeEducatorRepository,
  makePlanRepository,
  makeReportRepository,
  makeScaleApplicationRepository,
  makeScaleTemplateRepository,
  makeSessionEvolutionRepository,
  makeStudentRepository,
  makeTaskNotebookSessionRepository,
  makeTaskRepository,
} from "../../../../infraestructure/factories";
import { makeAuthMiddleware } from "../../../../infraestructure/middlewares";
import { GenerateStudentAnalysisUseCase } from "../../task-notebook-session/use-cases/generate-student-analisys/generate-student-analisys-use-case";
import { ReportContentBuilder } from "../report-content-builder";
import { GetReportOptionsUseCase } from "../use-cases/get-report-options/get-report-options-use-case";
import { GetReportOptionsController } from "../use-cases/get-report-options/get-report-options-controller";
import { CreateReportUseCase } from "../use-cases/create-report/create-report-use-case";
import { CreateReportController } from "../use-cases/create-report/create-report-controller";
import { ListReportsUseCase } from "../use-cases/list-reports/list-reports-use-case";
import { ListReportsController } from "../use-cases/list-reports/list-reports-controller";
import { GetReportUseCase } from "../use-cases/get-report/get-report-use-case";
import { GetReportController } from "../use-cases/get-report/get-report-controller";
import { ShareReportUseCase } from "../use-cases/share-report/share-report-use-case";
import { ShareReportController } from "../use-cases/share-report/share-report-controller";
import { DeleteReportUseCase } from "../use-cases/delete-report/delete-report-use-case";
import { DeleteReportController } from "../use-cases/delete-report/delete-report-controller";

const reportRouter = Router();

const educatorRepository = makeEducatorRepository({ isMock: false });
const studentRepository = makeStudentRepository({ isMock: false });
const reportRepository = makeReportRepository();

const contentBuilder = new ReportContentBuilder({
  analysisUseCase: new GenerateStudentAnalysisUseCase(
    studentRepository,
    makeTaskNotebookSessionRepository(),
    makeTaskRepository({ isMock: false })
  ),
  evolutionRepository: makeSessionEvolutionRepository(),
  planRepository: makePlanRepository(),
  applicationRepository: makeScaleApplicationRepository(),
  templateRepository: makeScaleTemplateRepository(),
  anamneseResponseRepository: makeAnamneseResponseRepository(),
});

const getReportOptionsUseCase = new GetReportOptionsUseCase();
const createReportUseCase = new CreateReportUseCase(
  reportRepository,
  studentRepository,
  contentBuilder,
  makeAiClinicalService()
);
const listReportsUseCase = new ListReportsUseCase(reportRepository, studentRepository);
const getReportUseCase = new GetReportUseCase(reportRepository, studentRepository);
const shareReportUseCase = new ShareReportUseCase(reportRepository, studentRepository);
const deleteReportUseCase = new DeleteReportUseCase(reportRepository, studentRepository);

const authMiddleware = makeAuthMiddleware(educatorRepository);

reportRouter.use(authMiddleware);

// Rota literal antes de /:id.
reportRouter.get("/options", async (req, res) => {
  new GetReportOptionsController(getReportOptionsUseCase).execute(req, res);
});

reportRouter.post("/", async (req, res) => {
  new CreateReportController(createReportUseCase).execute(req, res);
});

reportRouter.get("/", async (req, res) => {
  new ListReportsController(listReportsUseCase).execute(req, res);
});

reportRouter.post("/:id/share", async (req, res) => {
  new ShareReportController(shareReportUseCase).execute(req, res);
});

reportRouter.get("/:id", async (req, res) => {
  new GetReportController(getReportUseCase).execute(req, res);
});

reportRouter.delete("/:id", async (req, res) => {
  new DeleteReportController(deleteReportUseCase).execute(req, res);
});

export { reportRouter };
