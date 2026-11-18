import { Router } from "express";
import { authenticate, requireRole } from "../authorization/authorization.js";
import { requireAreaAccess } from "../authorization/areaScope.js";
import controller from "../controllers/area.controller.js";

const router = Router();
const adminOnly = requireRole("admin");
const managers = requireRole("admin", "area_admin");

router.get("/", [authenticate], controller.findAll);
router.get("/mine", [authenticate, managers], controller.findMine);
router.get("/:areaId", [authenticate, managers, requireAreaAccess], controller.findOne);
router.post("/", [authenticate, adminOnly], controller.create);
router.put("/:areaId", [authenticate, adminOnly], controller.update);
router.post("/:areaId/admins", [authenticate, adminOnly], controller.assignAdmin);
router.delete("/:areaId/admins/:userId", [authenticate, adminOnly], controller.removeAdmin);

export default router;
