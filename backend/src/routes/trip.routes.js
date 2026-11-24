import express from "express";
import {
  chatAboutTrip,
  deleteTrip,
  getTripById,
  getUserTrips,
  planTrip,
  shareTrip,
  unshareTrip,
  updateTrip,
} from "../controllers/trip.controller.js";
import protect from "../middleware/auth.middleware.js";
import { planLimiter } from "../middleware/rateLimit.js";
import { validateBody } from "../middleware/validate.js";
import { planTripSchema, tripChatSchema, updateTripSchema } from "../schemas/request.schemas.js";

const router = express.Router();

router.use(protect);
router.post("/plan", planLimiter, validateBody(planTripSchema), planTrip);
router.get("/", getUserTrips);
router.get("/:id", getTripById);
router.patch("/:id", validateBody(updateTripSchema), updateTrip);
router.delete("/:id", deleteTrip);
// A chat message can re-plan, so it shares the per-account planning limit.
router.post("/:id/chat", planLimiter, validateBody(tripChatSchema), chatAboutTrip);
router.post("/:id/share", shareTrip);
router.delete("/:id/share", unshareTrip);

export default router;
