import api from "../lib/axios";

// Everything the admin page shows, loaded in parallel. Fails as a whole on 401/403.
export const getAdminOverview = async (days = 30) => {
  const [stats, users, activity, feedback] = await Promise.all([
    api.get("/stats"),
    api.get("/stats/users"),
    api.get("/stats/activity", { params: { days } }),
    api.get("/stats/feedback"),
  ]);
  return {
    stats: stats.data.stats,
    users: users.data.users,
    activity: activity.data.activity,
    feedback: feedback.data.feedback,
  };
};
