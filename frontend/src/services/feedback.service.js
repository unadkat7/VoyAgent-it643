import api from "../lib/axios";

export const sendFeedback = async ({ rating, message, page }) => {
  const response = await api.post("/feedback", { rating, message: message || undefined, page });
  return response.data;
};
