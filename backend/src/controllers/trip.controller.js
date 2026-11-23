import { TripStatus } from "../domain/trip.js";
import * as tripService from "../services/trip.service.js";
import { recordEvent } from "../services/telemetry.service.js";

const PLANNER_UNAVAILABLE = 503;

export const planTrip = async (req, res) => {
  await recordEvent(req, "trip_plan_requested", { tripId: req.body.tripId });
  let trip;
  try {
    trip = await tripService.planTrip({
      userId: req.user._id,
      prompt: req.body.prompt,
      tripId: req.body.tripId,
    });
  } catch (error) {
    if (error.status === PLANNER_UNAVAILABLE) {
      await recordEvent(req, "trip_plan_failed", { tripId: error.body?.tripId });
    }
    throw error;
  }
  if (trip.status === TripStatus.PLANNED) {
    await recordEvent(req, "trip_planned", { tripId: trip._id });
  }
  res.status(200).json({ success: true, trip });
};

export const getUserTrips = async (req, res) => {
  const trips = await tripService.listTrips(req.user._id);
  res.status(200).json({ success: true, count: trips.length, trips });
};

export const getTripById = async (req, res) => {
  const trip = await tripService.findOwnedTrip(req.params.id, req.user._id);
  await recordEvent(req, "trip_viewed", { tripId: trip._id });
  res.status(200).json({ success: true, trip });
};

export const deleteTrip = async (req, res) => {
  await tripService.deleteTrip(req.params.id, req.user._id);
  await recordEvent(req, "trip_deleted", { tripId: req.params.id });
  res.status(200).json({ success: true, message: "Trip deleted" });
};
