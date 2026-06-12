import { Router } from "express";
import { makeAuthMiddleware } from "../../../../infraestructure/middlewares";
import { requireJobApiKey } from "../../../../infraestructure/middlewares";
import {
  makeAppointmentRepository,
  makeAppointmentSchedulerService,
  makeEducatorRepository,
} from "../../../../infraestructure/factories";
import { NodemailerMailService } from "../../../../infraestructure/services/mail-service-impl";

import { CreateAppointmentUseCase } from "../use-cases/create-appointment/create-appointment-use-case";
import { UpdateAppointmentUseCase } from "../use-cases/update-appointment/update-appointment-use-case";
import { DeleteAppointmentUseCase } from "../use-cases/delete-appointment/delete-appointment-use-case";
import { ListAppointmentsUseCase } from "../use-cases/list-appointments/list-appointments-use-case";
import { GetAppointmentUseCase } from "../use-cases/get-appointment/get-appointment-use-case";
import { NotifyAppointmentsUseCase } from "../use-cases/notify-appointments/notify-appointments-use-case";
import { WatchdogAppointmentsUseCase } from "../use-cases/watchdog-appointments/watchdog-appointments-use-case";

import { CreateAppointmentController } from "../controllers/create-appointment-controller";
import { UpdateAppointmentController } from "../controllers/update-appointment-controller";
import { DeleteAppointmentController } from "../controllers/delete-appointment-controller";
import { ListAppointmentsController } from "../controllers/list-appointments-controller";
import { GetAppointmentController } from "../controllers/get-appointment-controller";
import { NotifyAppointmentsController } from "../controllers/notify-appointments-controller";
import { WatchdogAppointmentsController } from "../controllers/watchdog-appointments-controller";

const appointmentRouter = Router();

const educatorRepository = makeEducatorRepository({ isMock: false });
const appointmentRepository = makeAppointmentRepository();
const schedulerService = makeAppointmentSchedulerService(appointmentRepository);
const mailService = new NodemailerMailService();

const createAppointmentUseCase = new CreateAppointmentUseCase(appointmentRepository, schedulerService);
const updateAppointmentUseCase = new UpdateAppointmentUseCase(appointmentRepository);
const deleteAppointmentUseCase = new DeleteAppointmentUseCase(appointmentRepository, schedulerService);
const listAppointmentsUseCase = new ListAppointmentsUseCase(appointmentRepository);
const getAppointmentUseCase = new GetAppointmentUseCase(appointmentRepository);
const notifyAppointmentsUseCase = new NotifyAppointmentsUseCase(appointmentRepository, educatorRepository, schedulerService, mailService);
const watchdogAppointmentsUseCase = new WatchdogAppointmentsUseCase(appointmentRepository, schedulerService);

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
