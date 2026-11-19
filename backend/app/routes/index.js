import { Router } from "express";
import authRoutes from "./auth.routes.js";
import userRoutes from "./user.routes.js";
import profileRoutes from "./profile.routes.js";
import vehicleTypeRoutes from "./vehicleType.routes.js";
import vehicleRoutes from "./vehicle.routes.js";
import areaRoutes from "./area.routes.js";
import requestRoutes from "./request.routes.js";
import reviewRoutes from "./review.routes.js";
import destinationRoutes from "./destination.routes.js";
import scheduleRoutes from "./schedule.routes.js";
import assignmentRoutes from "./assignment.routes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.use("/", authRoutes);
router.use("/users", userRoutes);
router.use("/profile", profileRoutes);
router.use("/vehicle-types", vehicleTypeRoutes);
router.use("/vehicles", vehicleRoutes);
router.use("/areas", areaRoutes);
router.use("/requests", requestRoutes);
router.use("/api/review", reviewRoutes);
router.use("/api/destinations", destinationRoutes);
router.use("/", scheduleRoutes);
router.use("/assignments", assignmentRoutes);

export default router;
