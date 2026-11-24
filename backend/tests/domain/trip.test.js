import { describe, expect, it } from "vitest";
import {
  TripRuleError,
  TripStatus,
  canContinue,
  canEditPlan,
  canShare,
  isOwnedBy,
  nextStatus,
} from "../../src/domain/trip.js";

describe("nextStatus", () => {
  it.each([
    [TripStatus.DRAFT, "needs_clarification", TripStatus.DRAFT],
    [TripStatus.DRAFT, "planned", TripStatus.PLANNED],
    [TripStatus.DRAFT, "failed", TripStatus.PLANNING_FAILED],
    [TripStatus.PLANNING_FAILED, "needs_clarification", TripStatus.DRAFT],
    [TripStatus.PLANNING_FAILED, "planned", TripStatus.PLANNED],
  ])("%s Trip with outcome %s becomes %s", (current, outcome, expected) => {
    expect(nextStatus(current, outcome)).toBe(expected);
  });

  it.each(["needs_clarification", "planned", "failed"])(
    "a planned Trip never goes back to planning (outcome %s)",
    (outcome) => {
      expect(() => nextStatus(TripStatus.PLANNED, outcome)).toThrow(TripRuleError);
    }
  );

  it("rejects an outcome the planner never sends", () => {
    expect(() => nextStatus(TripStatus.DRAFT, "booked")).toThrow(TripRuleError);
  });
});

describe("canContinue", () => {
  it.each([
    [TripStatus.DRAFT, true],
    [TripStatus.PLANNING_FAILED, true],
    [TripStatus.PLANNED, false],
  ])("%s -> %s", (status, expected) => {
    expect(canContinue(status)).toBe(expected);
  });
});

describe("canEditPlan", () => {
  it.each([
    [TripStatus.PLANNED, false, true],
    [TripStatus.PLANNED, true, false],
    [TripStatus.DRAFT, false, false],
    [TripStatus.PLANNING_FAILED, false, false],
  ])("a %s Trip (finalized: %s) can be edited in the chat: %s", (status, finalized, expected) => {
    expect(canEditPlan({ status, finalized })).toBe(expected);
  });
});

describe("isOwnedBy (Rule 5)", () => {
  const trip = { userId: { toString: () => "user-a" } };

  it("is true only for the account that created the Trip", () => {
    expect(isOwnedBy(trip, "user-a")).toBe(true);
    expect(isOwnedBy(trip, "user-b")).toBe(false);
  });
});

describe("TripStatus", () => {
  it("cannot be changed at runtime", () => {
    expect(Object.isFrozen(TripStatus)).toBe(true);
  });
});

describe("canShare", () => {
  it.each([
    [TripStatus.PLANNED, true],
    [TripStatus.DRAFT, false],
    [TripStatus.PLANNING_FAILED, false],
  ])("a %s Trip can be shared: %s", (status, expected) => {
    expect(canShare(status)).toBe(expected);
  });
});
