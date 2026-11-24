import express from "express";
import { getStatus, putStatus } from "../controllers/serviceStatus.controller.js";
import protect, { requireAdmin } from "../middleware/auth.middleware.js";
import { validateBody } from "../middleware/validate.js";
import { updateServiceStatusSchema } from "../schemas/request.schemas.js";

const router = express.Router();

router.get("/", getStatus);
router.put("/", protect, requireAdmin, validateBody(updateServiceStatusSchema), putStatus);

export default router;
