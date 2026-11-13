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
import { planRouter } from "../modules/plan/routes";
import { sessionEvolutionRouter } from "../modules/session-evolution/routes";
import { scaleTemplateRouter } from "../modules/scale-template/routes";
import { scaleApplicationRouter } from "../modules/scale-application/routes";
import { reportRouter } from "../modules/report/routes";

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
router.use("/plan", planRouter);
router.use("/session-evolution", sessionEvolutionRouter);
router.use("/scale-template", scaleTemplateRouter);
router.use("/scale-application", scaleApplicationRouter);
router.use("/report", reportRouter);

export { router };
