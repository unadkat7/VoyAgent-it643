import * as tripService from "../services/trip.service.js";

export const planTrip = async (req, res) => {
  const trip = await tripService.planTrip({
    userId: req.user._id,
    prompt: req.body.prompt,
    tripId: req.body.tripId,
  });
  res.status(200).json({ success: true, trip });
};

export const getUserTrips = async (req, res) => {
  const trips = await tripService.listTrips(req.user._id);
  res.status(200).json({ success: true, count: trips.length, trips });
};

export const getTripById = async (req, res) => {
  const trip = await tripService.findOwnedTrip(req.params.id, req.user._id);
  res.status(200).json({ success: true, trip });
};

export const deleteTrip = async (req, res) => {
  await tripService.deleteTrip(req.params.id, req.user._id);
  res.status(200).json({ success: true, message: "Trip deleted" });
};
