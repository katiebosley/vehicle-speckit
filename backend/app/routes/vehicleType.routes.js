import { Router } from "express";
import { authenticate, requireRole } from "../authorization/authorization.js";
import controller from "../controllers/vehicleType.controller.js";

const router = Router();

router.get("/", [authenticate], controller.findAll);
router.post("/", [authenticate, requireRole("admin")], controller.create);
router.put("/:vehicleTypeId", [authenticate, requireRole("admin")], controller.update);

export default router;
