import api from "../lib/axios";

export const sendPageview = async (path, referrer) => {
  await api.post("/events/pageview", referrer ? { path, referrer } : { path });
};

export const trackInteraction = (action, { value, tripId, path } = {}) => {
  const payload = { action };
  if (value) payload.value = value;
  if (tripId) payload.tripId = tripId;
  if (path) payload.path = path;
  return api.post("/events/interaction", payload).catch(() => {});
};
