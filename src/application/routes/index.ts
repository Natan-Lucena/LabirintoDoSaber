import { Router } from "express";
import { educatorRouter } from "../modules/educator/routes";

const router = Router();

router.use("/educators", educatorRouter);

export { router };
