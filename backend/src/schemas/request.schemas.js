import { z } from "zod";

const email = z.string().trim().toLowerCase().pipe(z.email());
const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid id");

export const signupSchema = z.object({
  name: z.string().trim().min(2).max(50),
  email,
  // bcrypt only uses the first 72 bytes of a password.
  password: z.string().min(8).max(72),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(200),
});

export const planTripSchema = z.object({
  prompt: z.string().trim().min(1).max(2000),
  tripId: objectId.optional(),
});

// Only same-site paths, so a page view can never carry a full URL.
export const pageviewSchema = z.object({
  path: z.string().trim().max(200).regex(/^\/(?!\/)/, "Must be a site path"),
});

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  message: z.string().trim().max(1000).optional(),
  page: z.string().trim().max(200).optional(),
});
