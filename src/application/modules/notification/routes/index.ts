import { Router } from "express";
import {
  makeAppointmentRepository,
  makeEducatorRepository,
  makeNotificationPreferencesRepository,
  makeNotificationRepository,
  makePlanRepository,
  makePushDispatchRepository,
  makePushReceiptRepository,
  makePushSender,
  makePushTokenRepository,
  makeScaleApplicationRepository,
  makeSessionEvolutionRepository,
  makeStudentAccessService,
  makeStudentRepository,
  makeStudentShareRepository,
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
import { SendDailyPushUseCase } from "../use-cases/send-daily-push/send-daily-push-use-case";
import { RegisterPushTokenUseCase } from "../use-cases/register-push-token/register-push-token-use-case";
import { RegisterPushTokenController } from "../use-cases/register-push-token/register-push-token-controller";
import { UnregisterPushTokenUseCase } from "../use-cases/unregister-push-token/unregister-push-token-use-case";
import { UnregisterPushTokenController } from "../use-cases/unregister-push-token/unregister-push-token-controller";
import { GetNotificationPreferencesUseCase } from "../use-cases/get-notification-preferences/get-notification-preferences-use-case";
import { GetNotificationPreferencesController } from "../use-cases/get-notification-preferences/get-notification-preferences-controller";
import { UpdateNotificationPreferencesUseCase } from "../use-cases/update-notification-preferences/update-notification-preferences-use-case";
import { UpdateNotificationPreferencesController } from "../use-cases/update-notification-preferences/update-notification-preferences-controller";

const notificationRouter = Router();

const educatorRepository = makeEducatorRepository({ isMock: false });
const studentRepository = makeStudentRepository({ isMock: false });
const notificationRepository = makeNotificationRepository();
const studentAccess = makeStudentAccessService();
const pushTokenRepository = makePushTokenRepository();
const preferencesRepository = makeNotificationPreferencesRepository();

const generateDailyNotificationsUseCase = new GenerateDailyNotificationsUseCase(
  makeAppointmentRepository(),
  makeTaskNotebookSessionRepository(),
  makeSessionEvolutionRepository(),
  makePlanRepository(),
  makeScaleApplicationRepository(),
  studentRepository,
  notificationRepository,
  makeStudentShareRepository()
);
const sendDailyPushUseCase = new SendDailyPushUseCase(
  notificationRepository,
  preferencesRepository,
  pushTokenRepository,
  makePushDispatchRepository(),
  makePushReceiptRepository(),
  makePushSender()
);
const registerPushTokenUseCase = new RegisterPushTokenUseCase(pushTokenRepository);
const unregisterPushTokenUseCase = new UnregisterPushTokenUseCase(pushTokenRepository);
const getNotificationPreferencesUseCase = new GetNotificationPreferencesUseCase(
  preferencesRepository
);
const updateNotificationPreferencesUseCase = new UpdateNotificationPreferencesUseCase(
  preferencesRepository
);
const listNotificationsUseCase = new ListNotificationsUseCase(
  notificationRepository,
  studentAccess
);
const unreadCountUseCase = new UnreadCountUseCase(
  notificationRepository,
  studentAccess
);
const markNotificationReadUseCase = new MarkNotificationReadUseCase(notificationRepository);
const markAllNotificationsReadUseCase = new MarkAllNotificationsReadUseCase(
  notificationRepository
);

const authMiddleware = makeAuthMiddleware(educatorRepository);

// Cron da Vercel (GET), protegido por CRON_SECRET e sem authMiddleware. Fica
// fora do Swagger público.
notificationRouter.get("/cron", requireCronSecret, async (req, res) => {
  new GenerateDailyNotificationsController(
    generateDailyNotificationsUseCase,
    sendDailyPushUseCase
  ).execute(req, res);
});

notificationRouter.post("/cron", requireCronSecret, async (req, res) => {
  new GenerateDailyNotificationsController(
    generateDailyNotificationsUseCase,
    sendDailyPushUseCase
  ).execute(req, res);
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

notificationRouter.post("/push-token", async (req, res) => {
  new RegisterPushTokenController(registerPushTokenUseCase).execute(req, res);
});

notificationRouter.delete("/push-token", async (req, res) => {
  new UnregisterPushTokenController(unregisterPushTokenUseCase).execute(req, res);
});

notificationRouter.get("/preferences", async (req, res) => {
  new GetNotificationPreferencesController(getNotificationPreferencesUseCase).execute(req, res);
});

notificationRouter.put("/preferences", async (req, res) => {
  new UpdateNotificationPreferencesController(updateNotificationPreferencesUseCase).execute(
    req,
    res
  );
});

notificationRouter.post("/:id/read", async (req, res) => {
  new MarkNotificationReadController(markNotificationReadUseCase).execute(req, res);
});

export { notificationRouter };
