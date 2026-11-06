import express from "express";
import { getMe, login, logout, signup } from "../controllers/auth.controller.js";
import protect from "../middleware/auth.middleware.js";
import { loginLimiter, signupLimiter } from "../middleware/rateLimit.js";
import { validateBody } from "../middleware/validate.js";
import { loginSchema, signupSchema } from "../schemas/request.schemas.js";

const router = express.Router();

router.post("/signup", signupLimiter, validateBody(signupSchema), signup);
router.post("/login", loginLimiter, validateBody(loginSchema), login);
router.post("/logout", logout);
router.get("/me", protect, getMe);

export default router;
