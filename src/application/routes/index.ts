import { Router } from "express";
import { educatorRouter } from "../modules/educator/routes";
import { studentRouter } from "../modules/student/routes";
import { taskRouter } from "../modules/task/routes";
import { taskNotebookSessionRouter } from "../modules/task-notebook-session/routes";
import { taskNotebookRouter } from "../modules/task-notebook/routes";
import { taskGroupRouter } from "../modules/task-group/routes";
import { anamneseTemplateRouter } from "../modules/anamnese-template/routes";
import { anamneseResponseRouter } from "../modules/anamnese-response/routes";
import { appointmentRouter } from "../modules/appointment/routes";
import { aiTaskRouter } from "../modules/ai-task/routes";

const router = Router();

router.use("/educator", educatorRouter);
router.use("/student", studentRouter);
router.use("/task", taskRouter);
router.use("/task-notebook", taskNotebookRouter);
router.use("/task-notebook-session", taskNotebookSessionRouter);
router.use("/task-group", taskGroupRouter);
router.use("/anamnese/templates", anamneseTemplateRouter);
router.use("/anamnese", anamneseResponseRouter);
router.use("/appointment", appointmentRouter);
router.use("/ai-task", aiTaskRouter);

export { router };
