import { Router } from "express";
import users from "../controllers/user.controller.js";
import { authenticate, requireRole } from "../authorization/authorization.js";

const router = Router();

router.use(authenticate, requireRole("admin"));

router.get("/", users.findAll);
router.get("/:userId", users.findOne);
router.put("/:userId", users.update);

export default router;
