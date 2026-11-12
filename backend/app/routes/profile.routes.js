import { Router } from "express";
import profile from "../controllers/profile.controller.js";
import { authenticate } from "../authorization/authorization.js";

const router = Router();

router.get("/", [authenticate], profile.findMe);
router.put("/", [authenticate], profile.updateMe);

export default router;
