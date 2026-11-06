import Feedback from "../models/feedback.model.js";

export const createFeedback = async (req, res) => {
  await Feedback.create({ ...req.body, userId: req.user._id });
  res.status(201).json({ success: true, message: "Thanks for the feedback" });
};
