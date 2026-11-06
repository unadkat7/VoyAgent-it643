import express from "express";
import {
  deleteTrip,
  getTripById,
  getUserTrips,
  planTrip,
} from "../controllers/trip.controller.js";
import protect from "../middleware/auth.middleware.js";
import { planLimiter } from "../middleware/rateLimit.js";
import { validateBody } from "../middleware/validate.js";
import { planTripSchema } from "../schemas/request.schemas.js";

const router = express.Router();

router.use(protect);
router.post("/plan", planLimiter, validateBody(planTripSchema), planTrip);
router.get("/", getUserTrips);
router.get("/:id", getTripById);
router.delete("/:id", deleteTrip);

export default router;
