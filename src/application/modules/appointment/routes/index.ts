import { Router } from "express";
import { makeAuthMiddleware } from "../../../../infraestructure/middlewares";
import { requireJobApiKey } from "../../../../infraestructure/middlewares";
import {
  makeAppointmentRepository,
  makeAppointmentSchedulerService,
  makeAppointmentSeriesRepository,
  makeEducatorRepository,
  makeStudentAccessService,
} from "../../../../infraestructure/factories";
import { NodemailerMailService } from "../../../../infraestructure/services/mail-service-impl";

import { CreateAppointmentUseCase } from "../use-cases/create-appointment/create-appointment-use-case";
import { UpdateAppointmentUseCase } from "../use-cases/update-appointment/update-appointment-use-case";
import { DeleteAppointmentUseCase } from "../use-cases/delete-appointment/delete-appointment-use-case";
import { ListAppointmentsUseCase } from "../use-cases/list-appointments/list-appointments-use-case";
import { GetAppointmentUseCase } from "../use-cases/get-appointment/get-appointment-use-case";
import { NotifyAppointmentsUseCase } from "../use-cases/notify-appointments/notify-appointments-use-case";
import { WatchdogAppointmentsUseCase } from "../use-cases/watchdog-appointments/watchdog-appointments-use-case";
import { CreateAppointmentSeriesUseCase } from "../use-cases/create-appointment-series/create-appointment-series-use-case";
import { GetAppointmentSeriesUseCase } from "../use-cases/get-appointment-series/get-appointment-series-use-case";
import { UpdateAppointmentSeriesUseCase } from "../use-cases/update-appointment-series/update-appointment-series-use-case";
import { CancelAppointmentSeriesUseCase } from "../use-cases/cancel-appointment-series/cancel-appointment-series-use-case";

import { CreateAppointmentController } from "../controllers/create-appointment-controller";
import { UpdateAppointmentController } from "../controllers/update-appointment-controller";
import { DeleteAppointmentController } from "../controllers/delete-appointment-controller";
import { ListAppointmentsController } from "../controllers/list-appointments-controller";
import { GetAppointmentController } from "../controllers/get-appointment-controller";
import { NotifyAppointmentsController } from "../controllers/notify-appointments-controller";
import { WatchdogAppointmentsController } from "../controllers/watchdog-appointments-controller";
import { CreateAppointmentSeriesController } from "../controllers/create-appointment-series-controller";
import { GetAppointmentSeriesController } from "../controllers/get-appointment-series-controller";
import { UpdateAppointmentSeriesController } from "../controllers/update-appointment-series-controller";
import { CancelAppointmentSeriesController } from "../controllers/cancel-appointment-series-controller";

const appointmentRouter = Router();

const educatorRepository = makeEducatorRepository({ isMock: false });
const appointmentRepository = makeAppointmentRepository();
const seriesRepository = makeAppointmentSeriesRepository();
const schedulerService = makeAppointmentSchedulerService(appointmentRepository);
const studentAccess = makeStudentAccessService();
const mailService = new NodemailerMailService();

const createAppointmentUseCase = new CreateAppointmentUseCase(appointmentRepository, schedulerService, studentAccess);
const updateAppointmentUseCase = new UpdateAppointmentUseCase(appointmentRepository, schedulerService, studentAccess);
const deleteAppointmentUseCase = new DeleteAppointmentUseCase(appointmentRepository, schedulerService, studentAccess);
const listAppointmentsUseCase = new ListAppointmentsUseCase(appointmentRepository, studentAccess);
const getAppointmentUseCase = new GetAppointmentUseCase(appointmentRepository, studentAccess);
const notifyAppointmentsUseCase = new NotifyAppointmentsUseCase(appointmentRepository, educatorRepository, schedulerService, mailService);
const watchdogAppointmentsUseCase = new WatchdogAppointmentsUseCase(appointmentRepository, schedulerService);
const createSeriesUseCase = new CreateAppointmentSeriesUseCase(appointmentRepository, seriesRepository, schedulerService, studentAccess);
const getSeriesUseCase = new GetAppointmentSeriesUseCase(appointmentRepository, seriesRepository, studentAccess);
const updateSeriesUseCase = new UpdateAppointmentSeriesUseCase(appointmentRepository, seriesRepository, schedulerService, studentAccess);
const cancelSeriesUseCase = new CancelAppointmentSeriesUseCase(appointmentRepository, seriesRepository, schedulerService, studentAccess);

const authMiddleware = makeAuthMiddleware(educatorRepository);

// Job routes (no auth, require job API key)
appointmentRouter.post("/notify", requireJobApiKey, async (req, res) => {
  new NotifyAppointmentsController(notifyAppointmentsUseCase).execute(req, res);
});

appointmentRouter.post("/watchdog", async (req, res) => {
  new WatchdogAppointmentsController(watchdogAppointmentsUseCase).execute(req, res);
});

// CRUD routes under auth middleware
appointmentRouter.use(authMiddleware);

appointmentRouter.post("/", async (req, res) => {
  new CreateAppointmentController(createAppointmentUseCase).execute(req, res);
});

appointmentRouter.get("/", async (req, res) => {
  new ListAppointmentsController(listAppointmentsUseCase).execute(req, res);
});

// Séries (rotas literais antes de /:id).
appointmentRouter.post("/series", async (req, res) => {
  new CreateAppointmentSeriesController(createSeriesUseCase).execute(req, res);
});

appointmentRouter.get("/series/:id", async (req, res) => {
  new GetAppointmentSeriesController(getSeriesUseCase).execute(req, res);
});

appointmentRouter.put("/series/:id", async (req, res) => {
  new UpdateAppointmentSeriesController(updateSeriesUseCase).execute(req, res);
});

appointmentRouter.post("/series/:id/cancel", async (req, res) => {
  new CancelAppointmentSeriesController(cancelSeriesUseCase).execute(req, res);
});

appointmentRouter.get("/:id", async (req, res) => {
  new GetAppointmentController(getAppointmentUseCase).execute(req, res);
});

appointmentRouter.put("/:id", async (req, res) => {
  new UpdateAppointmentController(updateAppointmentUseCase).execute(req, res);
});

appointmentRouter.delete("/:id", async (req, res) => {
  new DeleteAppointmentController(deleteAppointmentUseCase).execute(req, res);
});

export { appointmentRouter };
