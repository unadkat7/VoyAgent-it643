import express from "express";
import {
  signup,
  login,
  logout,
} from "../controllers/auth.controller.js";
import protect from "../middleware/auth.middleware.js";
import { getMe } from "../controllers/auth.controller.js";

const router = express.Router();

// Signup and login create the cookie used by protected requests.
router.post("/signup", signup);
router.post("/login", login);

// Logout and profile lookup use the same session cookie.
router.post("/logout", logout);
router.get("/me", protect, getMe);

export default router;

