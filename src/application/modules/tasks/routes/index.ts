import { Request, Response, Router } from "express";
import { MockTaskRepository } from "../../../../infraestructure/repositories/mock/task-repository-impl";
import { CreateTaskUseCase} from "../use-cases/create-task-use-case";
import { CreateTaskController } from "../use-cases/create-task-controller";

const tasksRouter = Router();

const taskRepository = new MockTaskRepository();
const createTaskUseCase = new CreateTaskUseCase(taskRepository);

tasksRouter.post("/create", (req: Request, res: Response) => {
    new CreateTaskController(createTaskUseCase).execute(req, res);
});

export { tasksRouter };