import api from "../lib/axios";

export const getServiceStatus = async () => {
  const response = await api.get("/status");
  return response.data.status;
};

export const updateServiceStatus = async (payload) => {
  const response = await api.put("/status", payload);
  return response.data.status;
};
