import { TripStatus } from "../domain/trip.js";
import * as tripService from "../services/trip.service.js";
import { recordEvent } from "../services/telemetry.service.js";

const PLANNER_UNAVAILABLE = 503;

export const planTrip = async (req, res) => {
  await recordEvent(req, "trip_plan_requested", { tripId: req.body.tripId });
  const startedAt = Date.now();
  let trip;
  try {
    trip = await tripService.planTrip({
      userId: req.user._id,
      prompt: req.body.prompt,
      tripId: req.body.tripId,
    });
  } catch (error) {
    if (error.status === PLANNER_UNAVAILABLE) {
      await recordEvent(req, "trip_plan_failed", {
        tripId: error.body?.tripId,
        durationMs: Date.now() - startedAt,
        meta: { outcome: "failed", statusCode: PLANNER_UNAVAILABLE },
      });
    }
    throw error;
  }
  if (trip.status === TripStatus.PLANNED) {
    await recordEvent(req, "trip_planned", {
      tripId: trip._id,
      durationMs: trip.planningLatencyMs,
      meta: {
        outcome: "planned",
        ...(trip.destination ? { destination: trip.destination } : {}),
        assumedFields: trip.plan?.assumed_fields ?? [],
      },
    });
  } else if (trip.status === TripStatus.DRAFT) {
    await recordEvent(req, "trip_clarification_requested", {
      tripId: trip._id,
      durationMs: trip.planningLatencyMs,
      meta: {
        outcome: "needs_clarification",
        missingFields: trip.clarification?.missingFields ?? [],
      },
    });
  }
  res.status(200).json({ success: true, trip });
};

export const chatAboutTrip = async (req, res) => {
  const startedAt = Date.now();
  let result;
  try {
    result = await tripService.editTrip({
      userId: req.user._id,
      tripId: req.params.id,
      message: req.body.message,
    });
  } catch (error) {
    if (error.status === PLANNER_UNAVAILABLE) {
      await recordEvent(req, "trip_plan_edit_failed", {
        tripId: req.params.id,
        durationMs: Date.now() - startedAt,
        meta: { outcome: "failed", statusCode: PLANNER_UNAVAILABLE },
      });
    }
    throw error;
  }
  const { trip, outcome, change, durationMs } = result;
  await recordEvent(req, "trip_plan_edited", {
    tripId: trip._id,
    durationMs,
    meta: { outcome, change },
  });
  res.status(200).json({ success: true, outcome, trip });
};

export const updateTrip = async (req, res) => {
  const trip = await tripService.updateTrip({
    userId: req.user._id,
    tripId: req.params.id,
    finalized: req.body.finalized,
    travelMode: req.body.travelMode,
  });
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

export const shareTrip = async (req, res) => {
  const trip = await tripService.shareTrip(req.params.id, req.user._id);
  await recordEvent(req, "trip_shared", { tripId: trip._id });
  res.status(200).json({ success: true, shareId: trip.shareId });
};

export const unshareTrip = async (req, res) => {
  await tripService.unshareTrip(req.params.id, req.user._id);
  res.status(200).json({ success: true, message: "Share link removed" });
};

export const viewSharedTrip = async (req, res) => {
  const { tripId, view } = await tripService.viewSharedTrip(req.params.shareId);
  await recordEvent(req, "shared_trip_viewed", { tripId });
  res.status(200).json({ success: true, trip: view });
};

export const deleteTrip = async (req, res) => {
  await tripService.deleteTrip(req.params.id, req.user._id);
  await recordEvent(req, "trip_deleted", { tripId: req.params.id });
  res.status(200).json({ success: true, message: "Trip deleted" });
};
