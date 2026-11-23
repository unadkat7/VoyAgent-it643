import mongoose from "mongoose";
import { TripStatus } from "../domain/trip.js";

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
    },
    // The Trip plan exactly as the Planning Engine returned it.
    plan: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
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
