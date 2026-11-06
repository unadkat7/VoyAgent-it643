import { rateLimit } from "express-rate-limit";

const limiter = (windowMinutes, limit, message, options = {}) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { success: false, message },
    ...options,
  });

export const loginLimiter = limiter(15, 10, "Too many login attempts. Try again in 15 minutes.");

export const signupLimiter = limiter(60, 50, "Too many sign-ups from this network. Try later.");

// Planning spends LLM and search quota, so it is limited per account, not per IP.
export const planLimiter = limiter(60, 30, "Planning limit reached. Try again in an hour.", {
  keyGenerator: (req) => req.user._id.toString(),
});
