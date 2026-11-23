import express from "express";
import { recordPageview } from "../controllers/event.controller.js";
import { optionalAuth } from "../middleware/auth.middleware.js";
import { pageviewLimiter } from "../middleware/rateLimit.js";
import { validateBody } from "../middleware/validate.js";
import { pageviewSchema } from "../schemas/request.schemas.js";

const router = express.Router();

router.post("/pageview", pageviewLimiter, validateBody(pageviewSchema), optionalAuth, recordPageview);

export default router;
