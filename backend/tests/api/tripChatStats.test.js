import { describe, expect, it } from "vitest";
import Event from "../../src/models/event.model.js";
import Trip from "../../src/models/trip.model.js";
import User from "../../src/models/user.model.js";
import { adminAgent, signedInAgent } from "../helpers.js";

// Its own file: the login limit is counted per app instance, and stats.test.js signs in often.
describe("admin stats for the trip chat", () => {
  it("counts trip chat use and plan edit outcomes, and reads the chosen travel cost", async () => {
    const asha = await signedInAgent("asha@example.com");
    const admin = await adminAgent();
    const ashaUser = await User.findOne({ email: "asha@example.com" });
    await Trip.create({
      userId: ashaUser._id,
      status: "planned",
      destination: "Goa",
      plan: {
        request: { destination: "Goa", budget: 40000, party_size: 2 },
        estimated_cost: { hotel_total: 10000, travel_total: 8000, total: 30000 },
      },
    });
    for (const [action, value] of [
      ["trip_chat_opened", "fab"],
      ["chat_chip_used", "cheaper"],
      ["travel_mode_selected", "train"],
      ["plan_stage_changed", "final"],
    ]) {
      await asha.post("/api/events/interaction").send({ action, value, path: "/trip/1" });
    }
    const edit = { userId: ashaUser._id, visitorHash: "v1", type: "trip_plan_edited" };
    await Event.create([
      { ...edit, meta: { outcome: "updated", change: "request" } },
      { ...edit, meta: { outcome: "answered", change: "question" } },
      { ...edit, meta: { outcome: "answered", change: "question" } },
    ]);

    const activity = (await admin.get("/api/stats/activity?days=7")).body.activity;
    const trips = (await admin.get("/api/stats/trips?days=30")).body.trips;

    expect(activity.featureEngagement.tripChat).toMatchObject({
      opens: 1,
      chipUses: 1,
      finalized: 1,
      travelModePicks: { train: 1, flight: 0 },
      edits: { updated: 1, answered: 2 },
    });
    expect(activity.daily.reduce((sum, day) => sum + day.planEdits, 0)).toBe(3);
    expect(trips.budgetAnalysis.avgFlightSharePct).toBe(20); // 8,000 travel of 40,000
  });
});
