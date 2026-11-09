import { Router } from "express";
import vehicleTypeRoutes from "./vehicleType.routes.js";

const router = Router();

router.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

router.use("/vehicle-types", vehicleTypeRoutes);

export default router;
