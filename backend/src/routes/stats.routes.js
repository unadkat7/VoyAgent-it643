import express from "express";
import { getStats } from "../controllers/stats.controller.js";
import protect, { requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/", protect, requireAdmin, getStats);

export default router;
