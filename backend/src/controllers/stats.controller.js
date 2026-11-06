import { TripStatus } from "../domain/trip.js";
import Feedback from "../models/feedback.model.js";
import Trip from "../models/trip.model.js";
import User from "../models/user.model.js";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Usage evidence for the project: how many people outside the team signed up and planned.
export const getStats = async (req, res) => {
  const weekAgo = new Date(Date.now() - WEEK_MS);
  const [accounts, signupsLast7Days, trips, plannedTrips, feedbackCount, ratings] =
    await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: weekAgo } }),
      Trip.countDocuments(),
      Trip.countDocuments({ status: TripStatus.PLANNED }),
      Feedback.countDocuments(),
      Feedback.aggregate([{ $group: { _id: null, average: { $avg: "$rating" } } }]),
    ]);

  res.status(200).json({
    success: true,
    stats: {
      accounts,
      signupsLast7Days,
      trips,
      plannedTrips,
      feedbackCount,
      averageRating: ratings[0] ? Math.round(ratings[0].average * 10) / 10 : null,
    },
  });
};
