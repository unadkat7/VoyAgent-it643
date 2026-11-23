import api from "../lib/axios";

// Everything the admin page shows, loaded in parallel. Fails as a whole on 401/403.
export const getAdminOverview = async (days = 30, weeks = 8) => {
  const [stats, users, activity, feedback, trips, retention] = await Promise.all([
    api.get("/stats", { params: { days } }),
    api.get("/stats/users"),
    api.get("/stats/activity", { params: { days } }),
    api.get("/stats/feedback"),
    api.get("/stats/trips", { params: { days } }),
    api.get("/stats/retention", { params: { weeks } }),
  ]);
  return {
    stats: stats.data.stats,
    users: users.data.users,
    activity: activity.data.activity,
    feedback: feedback.data.feedback,
    feedbackSummary: feedback.data.summary ?? null,
    trips: trips.data.trips,
    retention: retention.data.retention,
  };
};
