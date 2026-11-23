import express from "express";
import {
  getActivity,
  getRetention,
  getStats,
  getTripAnalytics,
  listFeedback,
  listUsers,
} from "../controllers/stats.controller.js";
import protect, { requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect, requireAdmin);
router.get("/", getStats);
router.get("/users", listUsers);
router.get("/activity", getActivity);
router.get("/trips", getTripAnalytics);
router.get("/feedback", listFeedback);
router.get("/retention", getRetention);

export default router;
