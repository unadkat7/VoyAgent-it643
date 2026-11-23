import express from "express";
import { getActivity, getStats, listFeedback, listUsers } from "../controllers/stats.controller.js";
import protect, { requireAdmin } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protect, requireAdmin);
router.get("/", getStats);
router.get("/users", listUsers);
router.get("/activity", getActivity);
router.get("/feedback", listFeedback);

export default router;
