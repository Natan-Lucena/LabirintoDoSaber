import { Router } from "express";
import {
  makeAppointmentRepository,
  makeEducatorRepository,
  makePlanRepository,
  makePlanReviewRepository,
  makeStudentRepository,
} from "../../../../infraestructure/factories";
import { makeAuthMiddleware } from "../../../../infraestructure/middlewares";
import { CreatePlanUseCase } from "../use-cases/create-plan/create-plan-use-case";
import { CreatePlanController } from "../use-cases/create-plan/create-plan-controller";
import { ListPlansUseCase } from "../use-cases/list-plans/list-plans-use-case";
import { ListPlansController } from "../use-cases/list-plans/list-plans-controller";
import { GetPlanUseCase } from "../use-cases/get-plan/get-plan-use-case";
import { GetPlanController } from "../use-cases/get-plan/get-plan-controller";
import { UpdatePlanUseCase } from "../use-cases/update-plan/update-plan-use-case";
import { UpdatePlanController } from "../use-cases/update-plan/update-plan-controller";
import { ChangeGoalStatusUseCase } from "../use-cases/change-goal-status/change-goal-status-use-case";
import { ChangeGoalStatusController } from "../use-cases/change-goal-status/change-goal-status-controller";
import { ClosePlanUseCase } from "../use-cases/close-plan/close-plan-use-case";
import { ClosePlanController } from "../use-cases/close-plan/close-plan-controller";
import { CreatePlanReviewUseCase } from "../use-cases/create-plan-review/create-plan-review-use-case";
import { CreatePlanReviewController } from "../use-cases/create-plan-review/create-plan-review-controller";
import { ListPlanReviewsUseCase } from "../use-cases/list-plan-reviews/list-plan-reviews-use-case";
import { ListPlanReviewsController } from "../use-cases/list-plan-reviews/list-plan-reviews-controller";

const planRouter = Router();

const educatorRepository = makeEducatorRepository({ isMock: false });
const studentRepository = makeStudentRepository({ isMock: false });
const appointmentRepository = makeAppointmentRepository();
const planRepository = makePlanRepository();
const planReviewRepository = makePlanReviewRepository();

const createPlanUseCase = new CreatePlanUseCase(planRepository, studentRepository, appointmentRepository);
const listPlansUseCase = new ListPlansUseCase(planRepository, studentRepository);
const getPlanUseCase = new GetPlanUseCase(planRepository, studentRepository);
const updatePlanUseCase = new UpdatePlanUseCase(planRepository, studentRepository);
const changeGoalStatusUseCase = new ChangeGoalStatusUseCase(planRepository, studentRepository);
const closePlanUseCase = new ClosePlanUseCase(planRepository, studentRepository);
const createPlanReviewUseCase = new CreatePlanReviewUseCase(planRepository, planReviewRepository, studentRepository);
const listPlanReviewsUseCase = new ListPlanReviewsUseCase(planRepository, planReviewRepository, studentRepository);

const authMiddleware = makeAuthMiddleware(educatorRepository);

planRouter.use(authMiddleware);

planRouter.post("/", async (req, res) => {
  new CreatePlanController(createPlanUseCase).execute(req, res);
});

planRouter.get("/", async (req, res) => {
  new ListPlansController(listPlansUseCase).execute(req, res);
});

planRouter.get("/:id", async (req, res) => {
  new GetPlanController(getPlanUseCase).execute(req, res);
});

planRouter.put("/:id", async (req, res) => {
  new UpdatePlanController(updatePlanUseCase).execute(req, res);
});

planRouter.put("/:id/goals/:goalId", async (req, res) => {
  new ChangeGoalStatusController(changeGoalStatusUseCase).execute(req, res);
});

planRouter.put("/:id/status", async (req, res) => {
  new ClosePlanController(closePlanUseCase).execute(req, res);
});

planRouter.post("/:id/reviews", async (req, res) => {
  new CreatePlanReviewController(createPlanReviewUseCase).execute(req, res);
});

planRouter.get("/:id/reviews", async (req, res) => {
  new ListPlanReviewsController(listPlanReviewsUseCase).execute(req, res);
});

export { planRouter };
