import crypto from "node:crypto";
import mongoose from "mongoose";
import { PlannerUnavailableError, requestEdit, requestPlan } from "../clients/aiPlanner.client.js";
import {
  TripStatus,
  canContinue,
  canEditPlan,
  canShare,
  isOwnedBy,
  nextStatus,
} from "../domain/trip.js";
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
  trip.planningAttempts = (trip.planningAttempts ?? 0) + 1;

  const startedAt = Date.now();
  let result;
  try {
    result = await requestPlan({ tripId: trip.id, conversation: trip.conversation });
  } catch (error) {
    if (!(error instanceof PlannerUnavailableError)) {
      throw error;
    }
    console.error(error.message);
    trip.planningLatencyMs = Math.max(0, Date.now() - startedAt);
    trip.lastError = "planner_unavailable";
    trip.status = nextStatus(trip.status, "failed");
    await trip.save();
    throw new HttpError(503, "The planner is unavailable right now. Please try again shortly.", {
      tripId: trip.id,
    });
  }

  trip.planningLatencyMs = Math.max(0, Date.now() - startedAt);
  trip.lastError = undefined;
  trip.status = nextStatus(trip.status, result.outcome);
  if (result.outcome === "needs_clarification") {
    trip.conversation.push({ role: "assistant", content: result.clarification.question });
    trip.clarification = result.clarification;
    trip.plan = null;
  } else {
    trip.plan = result.plan;
    trip.destination = result.plan.request.destination ?? undefined;
    trip.clarification = undefined;
    // The follow-up gives the first chat message its context ("Tell me your budget…").
    trip.conversation.push({
      role: "assistant",
      content: result.plan.follow_up || PLAN_READY,
    });
  }
  await trip.save();
  return { trip, rejectedReason: result.clarification?.reason ?? null };
}

const PLAN_READY = "Your Trip plan is ready. Ask me anything, or tell me what to change.";
// The planner reads only the latest turns; it gets the plan itself, so older talk adds little.
const EDIT_CONTEXT_TURNS = 20;

export async function editTrip({ userId, tripId, message }) {
  const trip = await findOwnedTrip(tripId, userId);
  if (trip.status !== TripStatus.PLANNED) {
    throw new HttpError(409, "Only a planned Trip can be changed in the chat.");
  }
  if (!canEditPlan(trip)) {
    throw new HttpError(409, "This plan is Final. Switch it to Draft to change it.");
  }
  const turns = [...trip.conversation, { role: "traveler", content: message }];
  const startedAt = Date.now();
  let result;
  try {
    result = await requestEdit({
      tripId: trip.id,
      conversation: turns.slice(-EDIT_CONTEXT_TURNS),
      plan: trip.plan,
      travelMode: trip.travelMode,
    });
  } catch (error) {
    if (!(error instanceof PlannerUnavailableError)) {
      throw error;
    }
    console.error(error.message);
    // Nothing is saved: the plan and the conversation stay as they were.
    throw new HttpError(503, "The planner is unavailable right now. Please try again shortly.", {
      tripId: trip.id,
    });
  }

  trip.conversation.push({ role: "traveler", content: message });
  trip.conversation.push({ role: "assistant", content: result.reply });
  if (result.outcome === "updated") {
    trip.plan = result.plan;
    trip.destination = result.plan.request.destination ?? undefined;
    // A picked travel mode the new plan no longer offers falls back to the cheapest.
    if (!travelModes(trip.plan).includes(trip.travelMode)) trip.travelMode = undefined;
  }
  await trip.save();
  return { trip, outcome: result.outcome, change: result.change, reason: result.reason ?? null, durationMs: Date.now() - startedAt };
}

const travelModes = (plan) => (plan?.travel_options ?? []).map((option) => option.mode);

export async function updateTrip({ userId, tripId, finalized, travelMode }) {
  const trip = await findOwnedTrip(tripId, userId);
  if (trip.status !== TripStatus.PLANNED) {
    throw new HttpError(409, "Only a planned Trip can be changed.");
  }
  if (travelMode !== undefined) {
    if (!travelModes(trip.plan).includes(travelMode)) {
      throw new HttpError(400, "This plan has no such way to travel.");
    }
    trip.travelMode = travelMode;
  }
  if (finalized !== undefined) trip.finalized = finalized;
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
    trip.sharedAt = new Date();
    await trip.save();
  }
  return trip;
}

export async function unshareTrip(tripId, userId) {
  const trip = await findOwnedTrip(tripId, userId);
  trip.shareId = undefined;
  trip.sharedAt = undefined;
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
    view: {
      destination: trip.destination,
      plan: trip.plan,
      // The owner's travel choice, so a shared total matches what the owner sees.
      travelMode: trip.travelMode,
      createdAt: trip.createdAt,
    },
  };
}

export async function deleteTrip(tripId, userId) {
  const trip = await findOwnedTrip(tripId, userId);
  await trip.deleteOne();
}
