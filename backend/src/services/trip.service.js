import crypto from "node:crypto";
import mongoose from "mongoose";
import { PlannerUnavailableError, requestPlan } from "../clients/aiPlanner.client.js";
import { canContinue, canShare, isOwnedBy, nextStatus } from "../domain/trip.js";
import Trip from "../models/trip.model.js";
import { HttpError } from "../utils/httpError.js";

// Rule 5: 400 for a malformed id, 404 if missing, 403 if another account owns it.
export async function findOwnedTrip(tripId, userId) {
  if (!mongoose.isValidObjectId(tripId)) {
    throw new HttpError(400, "Invalid trip id");
  }
  const trip = await Trip.findById(tripId);
  if (!trip) {
    throw new HttpError(404, "Trip not found");
  }
  if (!isOwnedBy(trip, userId)) {
    throw new HttpError(403, "You do not have access to this Trip");
  }
  return trip;
}

export async function planTrip({ userId, prompt, tripId }) {
  const trip = tripId ? await findOwnedTrip(tripId, userId) : new Trip({ userId });
  if (!canContinue(trip.status)) {
    throw new HttpError(409, "This Trip is already planned. Start a new Trip to change it.");
  }
  trip.conversation.push({ role: "traveler", content: prompt });

  let result;
  try {
    result = await requestPlan({ tripId: trip.id, conversation: trip.conversation });
  } catch (error) {
    if (!(error instanceof PlannerUnavailableError)) {
      throw error;
    }
    console.error(error.message);
    trip.status = nextStatus(trip.status, "failed");
    await trip.save();
    throw new HttpError(503, "The planner is unavailable right now. Please try again shortly.", {
      tripId: trip.id,
    });
  }

  trip.status = nextStatus(trip.status, result.outcome);
  if (result.outcome === "needs_clarification") {
    trip.conversation.push({ role: "assistant", content: result.clarification.question });
    trip.clarification = result.clarification;
    trip.plan = null;
  } else {
    trip.plan = result.plan;
    trip.destination = result.plan.request.destination ?? undefined;
    trip.clarification = undefined;
  }
  await trip.save();
  return trip;
}

export function listTrips(userId) {
  return Trip.find({ userId }).sort({ createdAt: -1 });
}

const SHARE_ID = /^[\w-]{16}$/;

export async function shareTrip(tripId, userId) {
  const trip = await findOwnedTrip(tripId, userId);
  if (!canShare(trip.status)) {
    throw new HttpError(409, "Only a planned Trip can be shared.");
  }
  if (!trip.shareId) {
    trip.shareId = crypto.randomBytes(12).toString("base64url");
    await trip.save();
  }
  return trip;
}

export async function unshareTrip(tripId, userId) {
  const trip = await findOwnedTrip(tripId, userId);
  trip.shareId = undefined;
  await trip.save();
}

// The public view: the plan only, never the conversation or the owning account.
export async function viewSharedTrip(shareId) {
  const trip = SHARE_ID.test(shareId)
    ? await Trip.findOneAndUpdate({ shareId }, { $inc: { shareViews: 1 } }, { new: true })
    : null;
  if (!trip) {
    throw new HttpError(404, "This shared Trip does not exist.");
  }
  return {
    tripId: trip._id,
    view: { destination: trip.destination, plan: trip.plan, createdAt: trip.createdAt },
  };
}

export async function deleteTrip(tripId, userId) {
  const trip = await findOwnedTrip(tripId, userId);
  await trip.deleteOne();
}
