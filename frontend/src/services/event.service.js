import api from "../lib/axios";

export const sendPageview = async (path) => {
  await api.post("/events/pageview", { path });
};
