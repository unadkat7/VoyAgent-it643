// Trip Status lifecycle. Pure: no Express, Mongoose or HTTP here.

export const TripStatus = Object.freeze({
  DRAFT: "draft",
  PLANNED: "planned",
  PLANNING_FAILED: "planning_failed",
});

const STATUS_FOR_OUTCOME = Object.freeze({
  needs_clarification: TripStatus.DRAFT,
  planned: TripStatus.PLANNED,
  failed: TripStatus.PLANNING_FAILED,
});

// A planned Trip is final; changing it means starting a new Trip.
const ALLOWED_NEXT = Object.freeze({
  [TripStatus.DRAFT]: [TripStatus.DRAFT, TripStatus.PLANNED, TripStatus.PLANNING_FAILED],
  [TripStatus.PLANNING_FAILED]: [TripStatus.DRAFT, TripStatus.PLANNED, TripStatus.PLANNING_FAILED],
  [TripStatus.PLANNED]: [],
});

export class TripRuleError extends Error {}

export function nextStatus(current, outcome) {
  const next = STATUS_FOR_OUTCOME[outcome];
  if (!next) {
    throw new TripRuleError(`Unknown planning outcome: ${outcome}`);
  }
  if (!ALLOWED_NEXT[current]?.includes(next)) {
    throw new TripRuleError(`A ${current} Trip cannot become ${next}`);
  }
  return next;
}

export function canContinue(status) {
  return (ALLOWED_NEXT[status] ?? []).length > 0;
}

// Rule 5: a Trip belongs to the account that created it.
export function isOwnedBy(trip, userId) {
  return trip.userId.toString() === String(userId);
}
