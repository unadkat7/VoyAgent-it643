import mongoose from "mongoose";

export const FEEDBACK_CATEGORIES = Object.freeze([
  "general",
  "planning",
  "itinerary",
  "budget",
  "map",
  "bug",
  "feature",
]);

const feedbackSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    message: { type: String, trim: true, maxlength: 1000 },
    page: { type: String, trim: true, maxlength: 200 },
    category: { type: String, enum: FEEDBACK_CATEGORIES, default: "general" },
  },
  { timestamps: true }
);

feedbackSchema.index({ createdAt: -1 });

const Feedback = mongoose.model("Feedback", feedbackSchema);

export default Feedback;
