import express from "express";
import { recordInteraction, recordPageview } from "../controllers/event.controller.js";
import { optionalAuth } from "../middleware/auth.middleware.js";
import { interactionLimiter, pageviewLimiter } from "../middleware/rateLimit.js";
import { validateBody } from "../middleware/validate.js";
import { interactionSchema, pageviewSchema } from "../schemas/request.schemas.js";

const router = express.Router();

router.post("/pageview", pageviewLimiter, validateBody(pageviewSchema), optionalAuth, recordPageview);
router.post(
  "/interaction",
  interactionLimiter,
  validateBody(interactionSchema),
  optionalAuth,
  recordInteraction
);

export default router;
