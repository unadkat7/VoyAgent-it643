import { z } from "zod";
import { TRAVEL_MODES } from "../domain/trip.js";
import { INTERACTION_ACTIONS } from "../models/event.model.js";
import { FEEDBACK_CATEGORIES } from "../models/feedback.model.js";

const email = z.string().trim().toLowerCase().pipe(z.email());
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");
const sitePath = z.string().trim().max(200).regex(/^\/(?!\/)/, "Must be a site path");

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(50),
  email,
  // bcrypt only uses the first 72 bytes of a password.
  password: z.string().min(8).max(72),
  signupSource: z.string().trim().max(120).optional(),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(200),
});

export const planTripSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  tripId: objectId.optional(),
});

export const tripChatSchema = z.object({
  message: z.string().trim().min(1).max(1000),
});

export const updateTripSchema = z
  .object({
    finalized: z.boolean().optional(),
    travelMode: z.enum(TRAVEL_MODES).optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, "Nothing to update");

// Only same-site paths, so a page view can never carry a full URL.
export const pageviewSchema = z.object({
  path: sitePath,
  referrer: z.string().trim().max(500).optional(),
});

// Strictly whitelisted UI interaction telemetry — never accepts free-text user input.
export const interactionSchema = z.object({
  action: z.enum(INTERACTION_ACTIONS),
  value: z.string().trim().max(60).regex(/^[\w-]+$/, "Invalid value").optional(),
  path: sitePath.optional(),
  tripId: objectId.optional(),
});

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  message: z.string().trim().max(1000).optional(),
  page: z.string().trim().max(200).optional(),
  category: z.enum(FEEDBACK_CATEGORIES).optional(),
});
