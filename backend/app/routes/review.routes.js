import { Router } from "express";
import { authenticate } from "../authorization/authorization.js";
import controller from "../controllers/review.controller.js";

const router = Router();

function requireAreaAdmin(req, res, next) {
  if (req.user?.role === "admin" || req.user?.role === "area_admin") {
    return next();
  }
  return res.status(403).send({ message: "Area admin role required." });
}

const reviewers = [authenticate, requireAreaAdmin];

router.use(reviewers);
router.get("/requests", controller.list);
router.get("/requests/:requestId/available-vehicles", controller.availableVehicles);
router.get("/requests/:requestId/eligible-drivers", controller.eligibleDrivers);
router.post("/requests/:requestId/approve", controller.approve);
router.post("/requests/:requestId/deny", controller.deny);
router.post("/requests/:requestId/assignments", controller.addAssignment);
router.put("/requests/:requestId/assignments/:assignmentId", controller.updateAssignment);
router.delete("/requests/:requestId/assignments/:assignmentId", controller.removeAssignment);
router.post("/requests/:requestId/complete", controller.complete);
router.put("/trip-logs/:tripLogId", controller.updateTripLog);

export default router;
