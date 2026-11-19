import { Router } from "express";
import { authenticate } from "../authorization/authorization.js";
import controller from "../controllers/destination.controller.js";

const router = Router();

function requireAreaAdmin(req, res, next) {
  if (req.user?.role === "admin" || req.user?.role === "area_admin") {
    return next();
  }
  return res.status(403).send({ message: "Area admin role required." });
}

router.get("/", authenticate, controller.list);
router.post("/", [authenticate, requireAreaAdmin], controller.create);
router.put("/:destinationId", [authenticate, requireAreaAdmin], controller.update);

export default router;
