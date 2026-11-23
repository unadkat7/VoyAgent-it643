import express from "express";
import { viewSharedTrip } from "../controllers/trip.controller.js";
import { publicLimiter } from "../middleware/rateLimit.js";

// Routes anyone can open without an account.
const router = express.Router();

router.get("/trips/:shareId", publicLimiter, viewSharedTrip);

export default router;
