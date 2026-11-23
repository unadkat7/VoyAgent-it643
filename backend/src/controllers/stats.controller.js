import { z } from "zod";
import {
  getActivityAnalytics,
  getFeedbackAnalytics,
  getOverviewStats,
  getRetentionAnalytics,
  getTripIntelligence,
  getUsersAnalytics,
  insiderIds,
} from "../services/stats.service.js";
import { HttpError } from "../utils/httpError.js";

const daysSchema = z.coerce.number().int().min(1).max(90).default(30);
const weeksSchema = z.coerce.number().int().min(2).max(12).default(8);

function parseDays(raw) {
  const parsed = daysSchema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(400, "days must be a whole number from 1 to 90");
  }
  return parsed.data;
}

function parseWeeks(raw) {
  const parsed = weeksSchema.safeParse(raw);
  if (!parsed.success) {
    throw new HttpError(400, "weeks must be a whole number from 2 to 12");
  }
  return parsed.data;
}

// Re-export so admin-exclusion policy remains discoverable from the controller boundary.
export { insiderIds };

export const getStats = async (req, res) => {
  const days = parseDays(req.query.days);
  const stats = await getOverviewStats(days);
  res.status(200).json({ success: true, stats });
};

export const listUsers = async (req, res) => {
  const users = await getUsersAnalytics();
  res.status(200).json({ success: true, users });
};

export const getActivity = async (req, res) => {
  const days = parseDays(req.query.days);
  const activity = await getActivityAnalytics(days);
  res.status(200).json({ success: true, activity });
};

export const getTripAnalytics = async (req, res) => {
  const days = parseDays(req.query.days);
  const trips = await getTripIntelligence(days);
  res.status(200).json({ success: true, trips });
};

export const listFeedback = async (req, res) => {
  const { feedback, summary } = await getFeedbackAnalytics();
  res.status(200).json({ success: true, feedback, summary });
};

export const getRetention = async (req, res) => {
  const weeks = parseWeeks(req.query.weeks);
  const retention = await getRetentionAnalytics(weeks);
  res.status(200).json({ success: true, retention });
};
