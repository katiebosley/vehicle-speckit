import { Router } from "express";
import { authenticate, requireRole } from "../authorization/authorization.js";
import controller from "../controllers/area.controller.js";

const router = Router();

router.get("/", [authenticate], controller.findAll);
router.get("/mine", [authenticate, requireRole("admin", "area_admin")], controller.findMine);

export default router;
