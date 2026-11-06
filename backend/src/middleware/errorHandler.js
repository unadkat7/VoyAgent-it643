import { TripRuleError } from "../domain/trip.js";
import { HttpError } from "../utils/httpError.js";

export const notFound = (req, res) => {
  res.status(404).json({ success: false, message: "Not found" });
};

// Express 5 sends errors thrown in async handlers here.
// eslint-disable-next-line no-unused-vars
export const errorHandler = (error, req, res, next) => {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ success: false, message: error.message, ...error.body });
  }
  if (error instanceof TripRuleError) {
    return res.status(409).json({ success: false, message: error.message });
  }
  if (error.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, message: "Malformed JSON" });
  }
  if (error.type === "entity.too.large") {
    return res.status(413).json({ success: false, message: "Request body is too large" });
  }

  console.error(error);
  return res.status(500).json({ success: false, message: "Something went wrong" });
};
