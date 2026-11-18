import { Router } from "express";
import auth from "../controllers/auth.controller.js";
import { authenticate } from "../authorization/authorization.js";

const router = Router();

router.post("/login", auth.login);
router.post("/logout", [authenticate], auth.logout);

export default router;
