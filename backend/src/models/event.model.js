import mongoose from "mongoose";

export const EVENT_TYPES = Object.freeze([
  "pageview",
  "signup",
  "login",
  "trip_plan_requested",
  "trip_clarification_requested",
  "trip_planned",
  "trip_plan_failed",
  "trip_plan_edited",
  "trip_plan_edit_failed",
  "trip_viewed",
  "trip_deleted",
  "trip_shared",
  "shared_trip_viewed",
  "feedback_submitted",
  "feature_interaction",
]);

export const INTERACTION_ACTIONS = Object.freeze([
  "map_style_changed",
  "map_fullscreen_opened",
  "map_pin_focused",
  "map_day_filtered",
  "map_layer_toggled",
  "map_reset_view",
  "map_google_maps_opened",
  "trip_tab_viewed",
  "hotel_deal_clicked",
  "brief_builder_submitted",
  "brief_builder_prefilled",
  "starter_trip_selected",
  "clarification_inline_submitted",
  "trip_chat_opened",
  "chat_chip_used",
  "travel_mode_selected",
  "plan_stage_changed",
]);

const RETENTION_SECONDS = 90 * 24 * 60 * 60;

// One thing a visitor did. Holds a network prefix and a daily hash, never the full IP.
const eventSchema = new mongoose.Schema({
  type: { type: String, enum: EVENT_TYPES, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: "Trip" },
  path: { type: String, maxlength: 200 },
  referrer: { type: String, maxlength: 120 },
  durationMs: { type: Number, min: 0 },
  meta: {
    action: { type: String, maxlength: 60 },
    value: { type: String, maxlength: 60 },
    outcome: { type: String, maxlength: 40 },
    destination: { type: String, maxlength: 120 },
    missingFields: [{ type: String, maxlength: 40 }],
    // Fields a plan guessed because the Traveler left them out.
    assumedFields: [{ type: String, maxlength: 40 }],
    // For plan edits: request, itinerary or question.
    change: { type: String, maxlength: 20 },
    statusCode: { type: Number },
    category: { type: String, maxlength: 40 },
  },
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
eventSchema.index({ createdAt: -1 });
eventSchema.index({ visitorHash: 1, createdAt: -1 });

const Event = mongoose.model("Event", eventSchema);

export default Event;
