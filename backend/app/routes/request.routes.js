import { Router } from "express";
import { authenticate, requireRole } from "../authorization/authorization.js";
import controller from "../controllers/request.controller.js";

const router = Router();

router.use(authenticate, requireRole("requestor"));
router.post("/", controller.create);
router.get("/", controller.findMine);
router.get("/:id", controller.findOne);
router.put("/:id", controller.update);
router.post("/:id/cancel", controller.cancel);

export default router;
