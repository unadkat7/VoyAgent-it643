import api from "../lib/axios";

// Plan or continue a trip conversation with VoyAgent AI
export const planTrip = async (data) => {
  const response = await api.post("/trips/plan", data);
  return response.data;
};

// Fetch all saved itineraries for the logged-in user
export const getUserTrips = async () => {
  const response = await api.get("/trips");
  return response.data;
};

// Fetch a single complete itinerary by ID
export const getTripById = async (id) => {
  const response = await api.get(`/trips/${id}`);
  return response.data;
};

// Delete a saved itinerary session
export const deleteTrip = async (id) => {
  const response = await api.delete(`/trips/${id}`);
  return response.data;
};

// One chat message about a planned Trip: an answer, or an edited plan
export const chatAboutTrip = async (id, message) => {
  const response = await api.post(`/trips/${id}/chat`, { message });
  return response.data;
};

// Draft/Final switch and the way to travel counted in the total
export const updateTrip = async (id, changes) => {
  const response = await api.patch(`/trips/${id}`, changes);
  return response.data;
};

// Create (or reuse) the public link for a planned Trip
export const shareTrip = async (id) => {
  const response = await api.post(`/trips/${id}/share`, {});
  return response.data;
};

export const unshareTrip = async (id) => {
  const response = await api.delete(`/trips/${id}/share`);
  return response.data;
};

// Read a shared Trip without an account
export const getSharedTrip = async (shareId) => {
  const response = await api.get(`/public/trips/${encodeURIComponent(shareId)}`);
  return response.data;
};
