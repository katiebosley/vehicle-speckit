import { Router } from "express";
import { authenticate, requireRole } from "../authorization/authorization.js";
import controller from "../controllers/vehicle.controller.js";

const router = Router();
const fleet = [authenticate, requireRole("admin", "area_admin")];

router.get("/", fleet, controller.findAll);
router.post("/", fleet, controller.create);
router.get("/:vehicleId", fleet, controller.findOne);
router.put("/:vehicleId", fleet, controller.update);
router.post("/:vehicleId/unavailability", fleet, controller.createWindow);
router.put("/:vehicleId/unavailability/:unavailabilityId", fleet, controller.updateWindow);
router.delete("/:vehicleId/unavailability/:unavailabilityId", fleet, controller.removeWindow);

export default router;
