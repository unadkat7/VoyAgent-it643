import mongoose from "mongoose";

// Singleton document ("global") storing whether AI planning is paused due to
// Groq & Cloudflare Workers AI API limit exhaustion.
const serviceStatusSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: "global",
    },
    isDown: {
      type: Boolean,
      default: false,
    },
    message: {
      type: String,
      maxlength: 280,
      default: null,
    },
    groqResetAt: {
      type: Date,
      default: null,
    },
    cloudflareResetAt: {
      type: Date,
      default: null,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

const ServiceStatus = mongoose.model("ServiceStatus", serviceStatusSchema);

export default ServiceStatus;
