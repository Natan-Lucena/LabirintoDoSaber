import { Request, Response, Router } from "express";
import {
  makeEducatorRepository,
  makeStudentRepository,
  makeTaskNotebookRepository,
  makeTaskNotebookSessionRepository,
  makeTaskRepository,
} from "../../../../infraestructure/factories";
import { makeAuthMiddleware } from "../../../../infraestructure/middlewares";
import { StartTaskNotebookSessionUseCase } from "../use-cases/start-task-notebook-session/start-task-session-use-case";
import { AnswerTaskNotebookSessionUseCase } from "../use-cases/answer-task-notebook-session/answer-task-notebook-session-use-case";
import { FinishTaskNotebookSessionUseCase } from "../use-cases/finish-task-notebook-session/finish-task-notebook-session-use-case";
import { StartTaskNotebookSessionController } from "../use-cases/start-task-notebook-session/start-task-session-controller";
import { AnswerTaskNotebookSessionController } from "../use-cases/answer-task-notebook-session/answer-task-notebook-session-controller";
import { FinishTaskNotebookController } from "../use-cases/finish-task-notebook-session/finish-task-notebook-session-controller";
import { ListTaskNotebookSessionByStudentIdUseCase } from "../use-cases/list-task-notebook-session-by-student-id/list-task-notebook-session-by-student-id-use-case";
import { ListTaskNotebookSessionByStudentIdController } from "../use-cases/list-task-notebook-session-by-student-id/list-task-notebook-session-by-student-id-controller";
import { GeneratorReportTaskNotebookSessionUseCase } from "../use-cases/generator-report-task-notebook-session/generator-report-task-notebook-session-use-case";
import { GeneratorReportTaskNotebookSessionController } from "../use-cases/generator-report-task-notebook-session/generator-report-task-notebook-session-controller";
import { GenerateStudentAnalysisUseCase } from "../use-cases/generate-student-analisys/generate-student-analisys-use-case";
import { GenerateStudentAnalysisController } from "../use-cases/generate-student-analisys/generate-student-analisys-controller";
import { AddObservationTaskNotebookSessionUseCase } from "../use-cases/add-observation-task-notebook-session/add-observation-task-notebook-session-use-case";
import { AddObservationTaskNotebookSessionController } from "../use-cases/add-observation-task-notebook-session/add-observation-task-notebook-session-controller";

const taskNotebookSessionRouter = Router();

const educatorRepository = makeEducatorRepository({ isMock: false });
const studentRepository = makeStudentRepository({ isMock: false });
const taskNotebookRepository = makeTaskNotebookRepository({ isMock: false });
const taskSessionRepository = makeTaskNotebookSessionRepository();
const taskRepository = makeTaskRepository({ isMock: false });
const authMiddleware = makeAuthMiddleware(educatorRepository);

const startTaskNotebookSessionUseCase = new StartTaskNotebookSessionUseCase(
  taskNotebookRepository,
  taskSessionRepository,
  studentRepository
);

const answerTaskNotebookSessionUseCase = new AnswerTaskNotebookSessionUseCase(
  taskSessionRepository,
  taskRepository,
  taskNotebookRepository
);

const finishTaskNotebookSessionUseCase = new FinishTaskNotebookSessionUseCase(
  taskSessionRepository
);

const listTaskNotebookSessionByStudentIdUseCase =
  new ListTaskNotebookSessionByStudentIdUseCase(taskSessionRepository);

const generateReportTaskNotebookSessionUseCase =
  new GeneratorReportTaskNotebookSessionUseCase(
    taskSessionRepository,
    taskRepository
  );

const generateStudentAnalisysUseCase = new GenerateStudentAnalysisUseCase(
  studentRepository,
  taskSessionRepository,
  taskRepository
);

const addObservationTaskNotebookSessionUseCase =
  new AddObservationTaskNotebookSessionUseCase(taskSessionRepository);

taskNotebookSessionRouter.use(authMiddleware);

taskNotebookSessionRouter.post("/start", (req: Request, res: Response) => {
  new StartTaskNotebookSessionController(
    startTaskNotebookSessionUseCase
  ).execute(req, res);
});

taskNotebookSessionRouter.post("/answer", (req: Request, res: Response) => {
  new AnswerTaskNotebookSessionController(
    answerTaskNotebookSessionUseCase
  ).execute(req, res);
});

taskNotebookSessionRouter.post("/finish", (req: Request, res: Response) => {
  new FinishTaskNotebookController(finishTaskNotebookSessionUseCase).execute(
    req,
    res
  );
});

taskNotebookSessionRouter.post("/observation", (req: Request, res: Response) => {
  new AddObservationTaskNotebookSessionController(
    addObservationTaskNotebookSessionUseCase
  ).execute(req, res);
});

taskNotebookSessionRouter.get(
  "/student/:studentId",
  (req: Request, res: Response) => {
    new ListTaskNotebookSessionByStudentIdController(
      listTaskNotebookSessionByStudentIdUseCase
    ).execute(req, res);
  }
);

taskNotebookSessionRouter.get(
  "/report/:sessionId",
  (req: Request, res: Response) => {
    new GeneratorReportTaskNotebookSessionController(
      generateReportTaskNotebookSessionUseCase
    ).execute(req, res);
  }
);

taskNotebookSessionRouter.get(
  "/analysis/student/:studentId",
  (req: Request, res: Response) => {
    new GenerateStudentAnalysisController(
      generateStudentAnalisysUseCase
    ).execute(req, res);
  }
);

export { taskNotebookSessionRouter };
