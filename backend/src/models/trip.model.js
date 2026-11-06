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
  },
  { timestamps: true }
);

tripSchema.index({ userId: 1, createdAt: -1 });

const Trip = mongoose.model("Trip", tripSchema);

export default Trip;
