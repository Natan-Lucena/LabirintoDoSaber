import { Router } from "express";
import {
  makeAppointmentRepository,
  makeEducatorRepository,
  makeNotificationRepository,
  makePlanRepository,
  makeScaleApplicationRepository,
  makeSessionEvolutionRepository,
  makeStudentRepository,
  makeTaskNotebookSessionRepository,
} from "../../../../infraestructure/factories";
import {
  makeAuthMiddleware,
  requireCronSecret,
} from "../../../../infraestructure/middlewares";
import { GenerateDailyNotificationsUseCase } from "../use-cases/generate-daily-notifications/generate-daily-notifications-use-case";
import { GenerateDailyNotificationsController } from "../use-cases/generate-daily-notifications/generate-daily-notifications-controller";
import { ListNotificationsUseCase } from "../use-cases/list-notifications/list-notifications-use-case";
import { ListNotificationsController } from "../use-cases/list-notifications/list-notifications-controller";
import { UnreadCountUseCase } from "../use-cases/unread-count/unread-count-use-case";
import { UnreadCountController } from "../use-cases/unread-count/unread-count-controller";
import { MarkNotificationReadUseCase } from "../use-cases/mark-notification-read/mark-notification-read-use-case";
import { MarkNotificationReadController } from "../use-cases/mark-notification-read/mark-notification-read-controller";
import { MarkAllNotificationsReadUseCase } from "../use-cases/mark-all-notifications-read/mark-all-notifications-read-use-case";
import { MarkAllNotificationsReadController } from "../use-cases/mark-all-notifications-read/mark-all-notifications-read-controller";

const notificationRouter = Router();

const educatorRepository = makeEducatorRepository({ isMock: false });
const studentRepository = makeStudentRepository({ isMock: false });
const notificationRepository = makeNotificationRepository();

const generateDailyNotificationsUseCase = new GenerateDailyNotificationsUseCase(
  makeAppointmentRepository(),
  makeTaskNotebookSessionRepository(),
  makeSessionEvolutionRepository(),
  makePlanRepository(),
  makeScaleApplicationRepository(),
  studentRepository,
  notificationRepository
);
const listNotificationsUseCase = new ListNotificationsUseCase(
  notificationRepository,
  studentRepository
);
const unreadCountUseCase = new UnreadCountUseCase(
  notificationRepository,
  studentRepository
);
const markNotificationReadUseCase = new MarkNotificationReadUseCase(notificationRepository);
const markAllNotificationsReadUseCase = new MarkAllNotificationsReadUseCase(
  notificationRepository
);

const authMiddleware = makeAuthMiddleware(educatorRepository);

// Cron da Vercel (GET), protegido por CRON_SECRET e sem authMiddleware. Fica
// fora do Swagger público.
notificationRouter.get("/cron", requireCronSecret, async (req, res) => {
  new GenerateDailyNotificationsController(generateDailyNotificationsUseCase).execute(req, res);
});

notificationRouter.post("/cron", requireCronSecret, async (req, res) => {
  new GenerateDailyNotificationsController(generateDailyNotificationsUseCase).execute(req, res);
});

notificationRouter.use(authMiddleware);

notificationRouter.get("/", async (req, res) => {
  new ListNotificationsController(listNotificationsUseCase).execute(req, res);
});

// Rotas literais antes de /:id.
notificationRouter.get("/unread-count", async (req, res) => {
  new UnreadCountController(unreadCountUseCase).execute(req, res);
});

notificationRouter.post("/read-all", async (req, res) => {
  new MarkAllNotificationsReadController(markAllNotificationsReadUseCase).execute(req, res);
});

notificationRouter.post("/:id/read", async (req, res) => {
  new MarkNotificationReadController(markNotificationReadUseCase).execute(req, res);
});

export { notificationRouter };
