import Feedback from "../models/feedback.model.js";
import { recordEvent } from "../services/telemetry.service.js";

export const createFeedback = async (req, res) => {
  await Feedback.create({ ...req.body, userId: req.user._id });
  await recordEvent(req, "feedback_submitted", { path: req.body.page });
  res.status(201).json({ success: true, message: "Thanks for the feedback" });
};
