import { Router } from "express";
import vehicleTypeRoutes from "./vehicleType.routes.js";
import vehicleRoutes from "./vehicle.routes.js";
import areaRoutes from "./area.routes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.use("/vehicle-types", vehicleTypeRoutes);
router.use("/vehicles", vehicleRoutes);
router.use("/areas", areaRoutes);

export default router;
