import { z } from "zod";
import { env } from "../config/env.js";
import { TripStatus } from "../domain/trip.js";
import Event from "../models/event.model.js";
import Feedback from "../models/feedback.model.js";
import Trip from "../models/trip.model.js";
import User from "../models/user.model.js";
import { HttpError } from "../utils/httpError.js";
import { maskEmail } from "../utils/maskEmail.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const TIMEZONE = "Asia/Kolkata";
const LIST_LIMIT = 200;
const RECENT_EVENTS = 50;

const daysSchema = z.coerce.number().int().min(1).max(90).default(30);

const dayKey = (date) => date.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
const dayOf = (field) => ({ $dateToString: { format: "%Y-%m-%d", date: field, timezone: TIMEZONE } });
const countIf = (type) => ({ $sum: { $cond: [{ $eq: ["$type", type] }, 1, 0] } });
const distinctVisitors = { $size: "$visitors" };

// Admin accounts are not evidence of outside use, so every query filters them out.
const insiderIds = () => User.find({ email: { $in: env.adminEmails } }).distinct("_id");

export const getStats = async (req, res) => {
  const insiders = await insiderIds();
  const outside = { userId: { $nin: insiders } };
  const weekAgo = new Date(Date.now() - 7 * DAY_MS);
  const [
    accounts,
    outsideAccounts,
    signupsLast7Days,
    trips,
    plannedTrips,
    outsidePlannedTrips,
    feedbackCount,
    ratings,
    visitors,
  ] = await Promise.all([
    User.countDocuments(),
    User.countDocuments({ _id: { $nin: insiders } }),
    User.countDocuments({ _id: { $nin: insiders }, createdAt: { $gte: weekAgo } }),
    Trip.countDocuments(),
    Trip.countDocuments({ status: TripStatus.PLANNED }),
    Trip.countDocuments({ ...outside, status: TripStatus.PLANNED }),
    Feedback.countDocuments(outside),
    Feedback.aggregate([
      { $match: outside },
      { $group: { _id: null, average: { $avg: "$rating" } } },
    ]),
    Event.distinct("visitorHash", { ...outside, type: "pageview", createdAt: { $gte: weekAgo } }),
  ]);

  res.status(200).json({
    success: true,
    stats: {
      accounts,
      outsideAccounts,
      signupsLast7Days,
      trips,
      plannedTrips,
      outsidePlannedTrips,
      feedbackCount,
      averageRating: ratings[0] ? Math.round(ratings[0].average * 10) / 10 : null,
      uniqueVisitors7d: visitors.length,
    },
  });
};

export const listUsers = async (req, res) => {
  const insiders = await insiderIds();
  const users = await User.find({ _id: { $nin: insiders } })
    .sort({ createdAt: -1 })
    .limit(LIST_LIMIT)
    .lean();
  const ids = users.map((user) => user._id);

  const [tripCounts, lastEvents] = await Promise.all([
    Trip.aggregate([
      { $match: { userId: { $in: ids } } },
      {
        $group: {
          _id: "$userId",
          trips: { $sum: 1 },
          plannedTrips: { $sum: { $cond: [{ $eq: ["$status", TripStatus.PLANNED] }, 1, 0] } },
        },
      },
    ]),
    Event.aggregate([
      { $match: { userId: { $in: ids } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$userId",
          lastActiveAt: { $first: "$createdAt" },
          country: { $first: "$country" },
          city: { $first: "$city" },
          device: { $first: "$device" },
        },
      },
    ]),
  ]);
  const tripsBy = new Map(tripCounts.map((row) => [String(row._id), row]));
  const eventsBy = new Map(lastEvents.map((row) => [String(row._id), row]));

  res.status(200).json({
    success: true,
    users: users.map((user) => {
      const trips = tripsBy.get(String(user._id));
      const last = eventsBy.get(String(user._id));
      return {
        email: maskEmail(user.email),
        joinedAt: user.createdAt,
        trips: trips?.trips ?? 0,
        plannedTrips: trips?.plannedTrips ?? 0,
        lastActiveAt: last?.lastActiveAt ?? null,
        country: last?.country ?? null,
        city: last?.city ?? null,
        device: last?.device ?? null,
      };
    }),
  });
};

export const getActivity = async (req, res) => {
  const parsed = daysSchema.safeParse(req.query.days);
  if (!parsed.success) {
    throw new HttpError(400, "days must be a whole number from 1 to 90");
  }
  const days = parsed.data;
  const now = Date.now();
  const since = new Date(now - days * DAY_MS);
  const insiders = await insiderIds();

  const [signups, [events], topShared] = await Promise.all([
    User.aggregate([
      { $match: { _id: { $nin: insiders }, createdAt: { $gte: since } } },
      { $group: { _id: dayOf("$createdAt"), count: { $sum: 1 } } },
    ]),
    Event.aggregate([
      { $match: { userId: { $nin: insiders }, createdAt: { $gte: since } } },
      {
        $facet: {
          byDay: [
            {
              $group: {
                _id: dayOf("$createdAt"),
                pageviews: countIf("pageview"),
                tripsPlanned: countIf("trip_planned"),
                visitors: { $addToSet: "$visitorHash" },
              },
            },
            { $project: { pageviews: 1, tripsPlanned: 1, visitors: distinctVisitors } },
          ],
          countries: [
            { $match: { country: { $ne: null } } },
            { $group: { _id: "$country", visitors: { $addToSet: "$visitorHash" } } },
            { $project: { _id: 0, country: "$_id", visitors: distinctVisitors } },
            { $sort: { visitors: -1, country: 1 } },
            { $limit: 10 },
          ],
          devices: [
            { $group: { _id: "$device.type", visitors: { $addToSet: "$visitorHash" } } },
            { $project: { _id: 0, type: "$_id", visitors: distinctVisitors } },
            { $sort: { visitors: -1, type: 1 } },
          ],
          recent: [
            { $sort: { createdAt: -1 } },
            { $limit: RECENT_EVENTS },
            {
              $lookup: {
                from: "users",
                localField: "userId",
                foreignField: "_id",
                pipeline: [{ $project: { email: 1 } }],
                as: "user",
              },
            },
          ],
        },
      },
    ]),
    Trip.find({ shareId: { $exists: true }, userId: { $nin: insiders } })
      .sort({ shareViews: -1 })
      .limit(10)
      .select({ _id: 0, destination: 1, shareViews: 1 })
      .lean(),
  ]);

  const signupsBy = new Map(signups.map((row) => [row._id, row.count]));
  const eventsBy = new Map(events.byDay.map((row) => [row._id, row]));
  const daily = Array.from({ length: days }, (_, index) => {
    const day = dayKey(new Date(now - (days - 1 - index) * DAY_MS));
    const row = eventsBy.get(day);
    return {
      day,
      signups: signupsBy.get(day) ?? 0,
      tripsPlanned: row?.tripsPlanned ?? 0,
      pageviews: row?.pageviews ?? 0,
      visitors: row?.visitors ?? 0,
    };
  });

  res.status(200).json({
    success: true,
    activity: {
      days,
      daily,
      countries: events.countries,
      devices: events.devices,
      topShared,
      recentEvents: events.recent.map((event) => ({
        type: event.type,
        path: event.path ?? null,
        user: event.user[0] ? maskEmail(event.user[0].email) : null,
        country: event.country ?? null,
        city: event.city ?? null,
        device: event.device ?? null,
        createdAt: event.createdAt,
      })),
    },
  });
};

export const listFeedback = async (req, res) => {
  const insiders = await insiderIds();
  const feedback = await Feedback.find({ userId: { $nin: insiders } })
    .sort({ createdAt: -1 })
    .limit(LIST_LIMIT)
    .select({ _id: 0, rating: 1, message: 1, page: 1, createdAt: 1 })
    .lean();

  res.status(200).json({ success: true, feedback });
};
