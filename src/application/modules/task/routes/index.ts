import { Request, Response, Router } from "express";
import { CreateTaskUseCase } from "../use-cases/create-task/create-task-use-case";
import { CreateTaskController } from "../use-cases/create-task/create-task-controller";
import { ListTasksUseCase } from "../use-cases/list-tasks/list-tasks-use-case";
import { ListTasksController } from "../use-cases/list-tasks/list-tasks-controller";
import { makeAuthMiddleware } from "../../../../infraestructure/middlewares";
import { UpdateTaskUseCase } from "../use-cases/update-task/update-task-use-case";
import { UpdateTaskController } from "../use-cases/update-task/update-task-controller";
import { DeleteTaskUseCase } from "../use-cases/delete-task/delete-task-use-case";
import { DeleteTaskController } from "../use-cases/delete-task/delete-task-controller";
import { GetTaskByIdUseCase } from "../use-cases/get-task-by-id/get-task-by-id-use-case";
import { GetTaskByIdController } from "../use-cases/get-task-by-id/get-task-by-id-controller";
import { SaveTaskBatchUseCase } from "../use-cases/save-task-batch/save-task-batch-use-case";
import { SaveTaskBatchController } from "../use-cases/save-task-batch/save-task-batch-controller";
import { UploadTaskMediaUseCase } from "../use-cases/upload-task-media/upload-task-media-use-case";
import { UploadTaskMediaController } from "../use-cases/upload-task-media/upload-task-media-controller";
import {
  makeEducatorRepository,
  makeFileStorage,
  makeTaskGroupRepository,
  makeTaskRepository,
} from "../../../../infraestructure/factories";
import { Multer } from "../../../../infraestructure/upload/multer-config";

const taskRouter = Router();

const taskRepository = makeTaskRepository({ isMock: false });
const fileStorage = makeFileStorage();
const taskGroupRepository = makeTaskGroupRepository();

const createTaskUseCase = new CreateTaskUseCase(taskRepository, fileStorage);

const listTasksUseCase = new ListTasksUseCase(taskRepository);

const updateTaskUseCase = new UpdateTaskUseCase(taskRepository);

const educatorRepository = makeEducatorRepository({ isMock: false });

const deleteTaskUseCase = new DeleteTaskUseCase(taskRepository);

const getTaskByIdUseCase = new GetTaskByIdUseCase(taskRepository);

const saveTaskBatchUseCase = new SaveTaskBatchUseCase(
  taskRepository,
  taskGroupRepository,
  educatorRepository
);

const uploadTaskMediaUseCase = new UploadTaskMediaUseCase(fileStorage);

const authMiddleware = makeAuthMiddleware(educatorRepository);

taskRouter.use(authMiddleware);

taskRouter.post(
  "/create",
  Multer.getUploader(10).fields([
    { name: "imageFile", maxCount: 1 },
    { name: "audioFile", maxCount: 1 },
  ]),
  (req: Request, res: Response) => {
    return new CreateTaskController(createTaskUseCase).execute(req, res);
  }
);

taskRouter.post("/batch", (req: Request, res: Response) => {
  new SaveTaskBatchController(saveTaskBatchUseCase).execute(req, res);
});

taskRouter.post(
  "/upload-media",
  Multer.getUploader(10).single("file"),
  (req: Request, res: Response) => {
    new UploadTaskMediaController(uploadTaskMediaUseCase).execute(req, res);
  }
);

taskRouter.get("/", (req: Request, res: Response) => {
  new ListTasksController(listTasksUseCase).execute(req, res);
});

taskRouter.put("/update", (req: Request, res: Response) => {
  new UpdateTaskController(updateTaskUseCase).execute(req, res);
});

taskRouter.delete("/delete/:id", (req: Request, res: Response) => {
  new DeleteTaskController(deleteTaskUseCase).execute(req, res);
});

taskRouter.get("/:id", (req: Request, res: Response) => {
  new GetTaskByIdController(getTaskByIdUseCase).execute(req, res);
});

export { taskRouter };
