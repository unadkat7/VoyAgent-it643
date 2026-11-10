import { describe, expect, it } from "vitest";
import {
  budgetBreakdown,
  composeBriefPrompt,
  formatInr,
  statusInfo,
  tripLink,
  tripRouteLabel,
  tripTitle,
} from "@/lib/tripView";
import { PLAN } from "./fixtures";

describe("formatInr", () => {
  it.each([
    [17500, "₹17,500"],
    [1234567, "₹12,34,567"],
    [0, "₹0"],
    [2499.6, "₹2,500"],
  ])("formats %s as %s", (amount, expected) => {
    expect(formatInr(amount)).toBe(expected);
  });

  it.each([null, undefined, Number.NaN])("shows a dash for a missing amount (%s)", (amount) => {
    expect(formatInr(amount)).toBe("—");
  });
});

describe("tripTitle", () => {
  it("prefers the Destination", () => {
    expect(tripTitle({ destination: "Goa", conversation: [{ content: "anything" }] })).toBe("Goa");
  });

  it("falls back to the Traveler's first message, shortened", () => {
    const content = "Plan a relaxed trip to the Kerala backwaters for my whole family";

    expect(tripTitle({ conversation: [{ role: "traveler", content }] })).toBe(
      "Plan a relaxed trip to the Kerala backwa…"
    );
  });

  it("names an empty Trip", () => {
    expect(tripTitle({})).toBe("New Trip");
  });
});

describe("statusInfo", () => {
  it.each([
    ["planned", "Planned", "View plan"],
    ["draft", "Needs details", "Continue"],
    ["planning_failed", "Planning failed", "Try again"],
  ])("%s shows %s and offers %s", (status, label, action) => {
    expect(statusInfo(status)).toMatchObject({ label, action });
  });
});

describe("tripLink", () => {
  it("opens a planned Trip and resumes any other Trip in the planner", () => {
    expect(tripLink({ _id: "t1", status: "planned" })).toBe("/trip/t1");
    expect(tripLink({ _id: "t2", status: "draft" })).toBe("/trip/new?tripId=t2");
    expect(tripLink({ _id: "t3", status: "planning_failed" })).toBe("/trip/new?tripId=t3");
  });
});

describe("tripRouteLabel", () => {
  it("combines Origin and Destination when both are known", () => {
    expect(tripRouteLabel({ destination: "Goa", plan: PLAN })).toBe("Ahmedabad → Goa");
  });

  it("returns null when Origin is missing", () => {
    expect(tripRouteLabel({ destination: "Goa" })).toBeNull();
  });
});

describe("budgetBreakdown", () => {
  it("computes INR shares and remaining buffer against the Budget", () => {
    expect(budgetBreakdown(PLAN)).toMatchObject({
      budget: 40000,
      hotelTotal: 7500,
      flightTotal: 10000,
      total: 17500,
      remaining: 22500,
      usedPercent: 44,
      hotelPercent: 19,
      flightPercent: 25,
    });
  });

  it("handles plans without a Budget cleanly", () => {
    expect(budgetBreakdown({ ...PLAN, request: {} })).toMatchObject({
      budget: 0,
      usedPercent: 0,
      remaining: 0,
    });
  });
});

describe("composeBriefPrompt", () => {
  it("composes all 6 required Trip Request fields into a natural prompt", () => {
    expect(
      composeBriefPrompt({
        origin: "Ahmedabad",
        destination: "Goa",
        duration_days: 3,
        party_size: 2,
        budget: 40000,
        travel_style: "Relaxed",
      })
    ).toBe("3 days in Goa, from Ahmedabad, 2 travelers, total budget ₹40,000, relaxed travel style");
  });
});
