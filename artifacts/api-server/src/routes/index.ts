import { Router, type IRouter } from "express";
import healthRouter from "./health";
import accessxRouter from "./accessx";

const router: IRouter = Router();

router.use(healthRouter);
router.use(accessxRouter);

export default router;
