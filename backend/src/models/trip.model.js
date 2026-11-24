import mongoose from "mongoose";
import { TRAVEL_MODES, TripStatus } from "../domain/trip.js";

const conversationTurnSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["traveler", "assistant"], required: true },
    content: { type: String, required: true, maxlength: 4000 },
  },
  { _id: false }
);

const tripSchema = new mongoose.Schema(
  {
    // The account that owns the Trip (Rule 5). "User" is the account, not a Traveler.
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(TripStatus),
      default: TripStatus.DRAFT,
    },
    conversation: [conversationTurnSchema],
    destination: { type: String, trim: true },
    clarification: {
      missingFields: [String],
      question: String,
      suggestions: { type: Map, of: Number, default: undefined },
    },
    // The Trip plan exactly as the Planning Engine returned it.
    plan: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    // Draft/Final switch for a planned Trip: Final locks the plan against chat edits.
    finalized: { type: Boolean, default: false },
    // The way to travel the owner picked for the total; unset means the cheapest.
    travelMode: { type: String, enum: TRAVEL_MODES },
    // Set only while the owner shares the Trip through a public link.
    shareId: { type: String, unique: true, sparse: true },
    shareViews: { type: Number, default: 0 },
    sharedAt: { type: Date },
    // Durable planning telemetry kept even after the 90-day Event TTL expires.
    planningAttempts: { type: Number, default: 0, min: 0 },
    planningLatencyMs: { type: Number, min: 0 },
    lastError: { type: String, maxlength: 120 },
  },
  { timestamps: true }
);

tripSchema.index({ userId: 1, createdAt: -1 });
tripSchema.index({ status: 1, createdAt: -1 });

const Trip = mongoose.model("Trip", tripSchema);

export default Trip;
