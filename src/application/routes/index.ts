import { Router } from "express";
import { educatorRouter } from "../modules/educator/routes";
import { studentRouter } from "../modules/student/routes";

const router = Router();

router.use("/educators", educatorRouter);
router.use("/students", studentRouter);

export { router };
