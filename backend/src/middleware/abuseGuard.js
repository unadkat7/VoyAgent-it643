import Event from "../models/event.model.js";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_REJECTED = 5;

export default async function abuseGuard(req, res, next) {
  const rejected = await Event.countDocuments({
    userId: req.user._id,
    type: "trip_input_rejected",
    createdAt: { $gte: new Date(Date.now() - WINDOW_MS) },
  });
  if (rejected >= MAX_REJECTED) {
    return res.status(429).json({
      success: false,
      message: "Too many requests I couldn't plan. Try again in an hour with a real place.",
    });
  }
  next();
}
