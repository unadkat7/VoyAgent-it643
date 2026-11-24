import { getServiceStatus } from "../services/serviceStatus.service.js";

// Blocks AI planning and trip chat while an admin-published downtime notice is active
// (both Groq and Cloudflare Workers AI limits reached). Saved and shared trips stay readable.
export default async function serviceAvailabilityGuard(req, res, next) {
  const status = await getServiceStatus();
  if (status.isDown) {
    return res.status(503).json({
      success: false,
      code: "AI_LIMIT_REACHED",
      message: status.message,
      status,
    });
  }
  next();
}
