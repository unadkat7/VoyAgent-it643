import { describe, expect, it } from "vitest";
import {
  budgetBreakdown,
  chosenTravel,
  composeBriefPrompt,
  fareRange,
  formatInr,
  mapDays,
  mapPoints,
  statusInfo,
  tripLink,
  tripRouteLabel,
  tripTitle,
} from "@/lib/tripView";
import { LOCATED_PLAN, PLAN } from "./fixtures";

describe("mapPoints", () => {
  it("maps stays and one labeled pin for each day with a located activity", () => {
    const points = mapPoints(LOCATED_PLAN, "all");

    expect(points.map((p) => [p.kind, p.title])).toEqual([
      ["hotel", "Sea Breeze Resort"],
      ["day", "Day 1"],
      ["day", "Day 2"],
    ]);
  });

  it("numbers Activities by their place in the day, so pins match the Itinerary", () => {
    const titos = mapPoints(LOCATED_PLAN, 1).find((p) => p.title === "Tito's Lane");

    expect(titos).toMatchObject({ day: 1, order: 3, lat: 15.556, lng: 73.752 });
  });

  it("shows only the selected day's activities", () => {
    const points = mapPoints(LOCATED_PLAN, 2);

    expect(points.map((p) => p.title)).toEqual(["Fort Aguada"]);
  });

  it("is empty for a plan made before Coordinates existed", () => {
    expect(mapPoints(PLAN, "all")).toEqual([]);
  });
});

describe("mapDays", () => {
  it("lists only days that have a located Activity", () => {
    expect(mapDays(LOCATED_PLAN)).toEqual([1, 2]);
  });
});

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
  it("computes INR shares and remaining buffer against the Budget (an older flights-only plan)", () => {
    expect(budgetBreakdown(PLAN)).toMatchObject({
      budget: 40000,
      hotelTotal: 7500,
      travelTotal: 10000,
      travel: null,
      activitiesTotal: 0,
      dailySpendTotal: 0,
      total: 17500,
      perPerson: 8750,
      remaining: 22500,
      overBy: 0,
      usedPercent: 44,
      segments: [
        { key: "hotel", percent: 19 },
        { key: "travel", percent: 25 },
        { key: "activities", percent: 0 },
        { key: "daily", percent: 0 },
      ],
    });
  });

  it("counts activities and daily spend, and says how far over the Budget it goes", () => {
    const plan = {
      ...PLAN,
      assumed_fields: ["budget"],
      estimated_cost: {
        hotel_total: 20000,
        flight_total: 14000,
        activities_total: 2000,
        daily_spend_total: 9000,
        total: 45000,
        per_person: 22500,
        rooms: 1,
      },
    };

    const breakdown = budgetBreakdown(plan);

    expect(breakdown).toMatchObject({ total: 45000, perPerson: 22500, overBy: 5000, remaining: 0 });
    expect(breakdown.budgetGuessed).toBe(true);
    expect(breakdown.segments.reduce((sum, s) => sum + s.percent, 0)).toBe(100);
  });

  it("counts the picked way to travel, else the plan's default, in the total", () => {
    const plan = {
      ...PLAN,
      travel_options: [
        { mode: "train", label: "Train · 3AC", per_person_low: 3000, per_person_high: 4000, total: 7000 },
        { mode: "flight", label: "Flight · IndiGo", per_person_low: 5000, per_person_high: 5000, total: 10000 },
      ],
      estimated_cost: { hotel_total: 7500, travel_total: 7000, travel_mode: "train", total: 14500 },
    };

    expect(budgetBreakdown(plan)).toMatchObject({ travelTotal: 7000, total: 14500 });
    expect(budgetBreakdown(plan, "flight")).toMatchObject({ travelTotal: 10000, total: 17500 });
    expect(budgetBreakdown(plan, "car").travel.mode).toBe("train"); // no car option
    expect(chosenTravel(plan, "flight").label).toBe("Flight · IndiGo");
    expect(fareRange(plan.travel_options[0])).toBe("₹3,000–₹4,000");
    expect(fareRange(plan.travel_options[1])).toBe("₹5,000");
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
