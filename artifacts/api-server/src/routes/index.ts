import { Router, type IRouter } from "express";
import accessxRouter from "./accessx";

const router: IRouter = Router();

router.use(accessxRouter);

export default router;
