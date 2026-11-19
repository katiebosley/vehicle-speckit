import { Router } from "express";
import { authenticate, requireRole } from "../authorization/authorization.js";
import controller from "../controllers/schedule.controller.js";

const router = Router();

router.get("/calendar", [authenticate, requireRole("admin", "area_admin")], controller.calendar);
router.get("/availability", [authenticate], controller.availability);
router.get("/dashboard", [authenticate], controller.dashboard);

export default router;
