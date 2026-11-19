import { Router } from "express";
import { authenticate } from "../authorization/authorization.js";
import controller from "../controllers/tripLog.controller.js";

const router = Router();

router.post("/:assignmentId/checkout", [authenticate], controller.checkout);
router.post("/:assignmentId/checkin", [authenticate], controller.checkin);

export default router;
