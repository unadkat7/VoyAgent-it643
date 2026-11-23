import mongoose from "mongoose";

export const EVENT_TYPES = Object.freeze([
  "pageview",
  "signup",
  "login",
  "trip_plan_requested",
  "trip_planned",
  "trip_plan_failed",
  "trip_viewed",
  "trip_deleted",
  "trip_shared",
  "shared_trip_viewed",
  "feedback_submitted",
]);

const RETENTION_SECONDS = 90 * 24 * 60 * 60;

// One thing a visitor did. Holds a network prefix and a daily hash, never the full IP.
const eventSchema = new mongoose.Schema({
  type: { type: String, enum: EVENT_TYPES, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" },
  path: { type: String, maxlength: 200 },
  visitorHash: { type: String, required: true },
  ipPrefix: String,
  country: String,
  city: String,
  device: {
    type: { type: String },
    os: String,
    browser: String,
  },
  createdAt: { type: Date, default: Date.now, expires: RETENTION_SECONDS },
});

eventSchema.index({ type: 1, createdAt: -1 });
eventSchema.index({ userId: 1, createdAt: -1 });

const Event = mongoose.model("Event", eventSchema);

export default Event;
