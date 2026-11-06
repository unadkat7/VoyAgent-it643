import express from "express";
import { createFeedback } from "../controllers/feedback.controller.js";
import protect from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validate.js";
import { feedbackSchema } from "../schemas/request.schemas.js";

const router = express.Router();

router.post("/", protect, validateBody(feedbackSchema), createFeedback);

export default router;
