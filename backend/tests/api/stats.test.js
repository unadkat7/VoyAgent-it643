import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../../src/app.js";
import { env } from "../../src/config/env.js";
import Feedback from "../../src/models/feedback.model.js";
import Trip from "../../src/models/trip.model.js";
import User from "../../src/models/user.model.js";
import { seedAdmin } from "../../src/services/admin.service.js";
import { ADMIN_EMAIL, PASSWORD, adminAgent, signedInAgent } from "../helpers.js";

// One outside Traveler and one admin, each with some activity.
async function mixedUsage() {
  const asha = await signedInAgent("asha@example.com");
  await asha.post("/api/feedback").send({ rating: 4, message: "Loved it", page: "/dashboard" });
  await asha.post("/api/events/pageview").send({ path: "/dashboard" });
  const admin = await adminAgent();
  await admin.post("/api/feedback").send({ rating: 2, message: "admin test" });
  await admin.post("/api/events/pageview").send({ path: "/admin" });
  return { asha, admin };
}

describe("admin accounts", () => {
  it("cannot be created through public sign-up", async () => {
    const response = await request(app)
      .post("/api/auth/signup")
      .send({ name: "Mallory", email: ADMIN_EMAIL, password: PASSWORD });

    expect(response.status).toBe(403);
    expect(await User.exists({ email: ADMIN_EMAIL })).toBeNull();
  });

  it("are created or reset by the seed", async () => {
    await seedAdmin({ email: ADMIN_EMAIL, password: "first-password" });
    await seedAdmin({ email: ADMIN_EMAIL, password: "second-password" });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: ADMIN_EMAIL, password: "second-password" });
    expect(login.status).toBe(200);
    expect(await User.countDocuments({ email: ADMIN_EMAIL })).toBe(1);
  });

  it("are flagged by /api/auth/me", async () => {
    const admin = await adminAgent();
    const traveler = await signedInAgent();

    expect((await admin.get("/api/auth/me")).body.user.isAdmin).toBe(true);
    expect((await traveler.get("/api/auth/me")).body.user.isAdmin).toBe(false);
  });
});

describe.each([
  "/api/stats",
  "/api/stats/users",
  "/api/stats/activity",
  "/api/stats/trips",
  "/api/stats/feedback",
  "/api/stats/retention",
])(
  "GET %s",
  (path) => {
    it("is only for admins", async () => {
      const traveler = await signedInAgent();

      expect((await traveler.get(path)).status).toBe(403);
      expect((await request(app).get(path)).status).toBe(401);
    });
  }
);

describe("usage stats for an admin", () => {
  it("counts everyone but separates outside users from admins", async () => {
    const { admin } = await mixedUsage();

    const { stats } = (await admin.get("/api/stats")).body;

    expect(stats).toMatchObject({
      accounts: 2,
      outsideAccounts: 1,
      trips: 0,
      outsidePlannedTrips: 0,
      feedbackCount: 1,
      averageRating: 4,
      uniqueVisitors7d: 1,
    });
  });

  it("lists outside users with masked emails", async () => {
    const { admin } = await mixedUsage();

    const { users } = (await admin.get("/api/stats/users")).body;

    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ email: "as***@example.com", trips: 0, plannedTrips: 0 });
    expect(users[0].lastActiveAt).toBeDefined();
    expect(JSON.stringify(users)).not.toContain("asha@example.com");
  });

  it("buckets outside activity by day and hides admin Events", async () => {
    const { admin } = await mixedUsage();

    const { activity } = (await admin.get("/api/stats/activity?days=7")).body;

    expect(activity.daily).toHaveLength(7);
    expect(activity.daily.at(-1)).toMatchObject({ signups: 1, pageviews: 1, visitors: 1 });
    expect(activity.recentEvents.map((event) => event.user)).not.toContain("ad***@voyagent.test");
    expect(activity.recentEvents.map((event) => event.type)).toContain("feedback_submitted");
    expect(activity.devices).toEqual([{ type: "desktop", visitors: 1 }]);
  });

  it.each(["0", "91", "abc"])("rejects days=%s", async (days) => {
    const admin = await adminAgent();

    expect((await admin.get(`/api/stats/activity?days=${days}`)).status).toBe(400);
  });

  it("shows the outside feedback log without who wrote it", async () => {
    const { admin } = await mixedUsage();

    const { feedback, summary } = (await admin.get("/api/stats/feedback")).body;

    expect(feedback).toHaveLength(1);
    expect(feedback[0]).toMatchObject({ rating: 4, message: "Loved it", page: "/dashboard" });
    expect(feedback[0].userId).toBeUndefined();
    expect(summary).toMatchObject({ total: 1, averageRating: 4, npsProxy: 100 });
  });

  it("aggregates Travel Intelligence, TripMap engagement, and handles legacy docs safely", async () => {
    const { asha, admin } = await mixedUsage();
    const ashaUser = await User.findOne({ email: "asha@example.com" });
    const adminUser = await User.findOne({ email: ADMIN_EMAIL });

    // One rich planned Trip + one legacy draft Trip missing new optional fields + one admin Trip.
    await Trip.create([
      {
        userId: ashaUser._id,
        status: "planned",
        destination: "Goa",
        planningAttempts: 1,
        planningLatencyMs: 2400,
        plan: {
          nights: 3,
          destination_coordinates: { lat: 15.2993, lng: 74.124 },
          request: {
            origin: "Ahmedabad",
            destination: "Goa",
            duration_days: 4,
            budget: 40000,
            party_size: 2,
            travel_style: "relaxed",
          },
          estimated_cost: { hotel_total: 12000, flight_total: 10000, total: 22000 },
          hotels: [{ name: "Sea Breeze", price_source: "live" }],
          flights: [{ airline: "IndiGo", price_source: "estimated" }],
        },
      },
      {
        userId: ashaUser._id,
        status: "draft",
        clarification: { missingFields: ["budget", "travel_style"], question: "Budget?" },
      },
      {
        userId: adminUser._id,
        status: "planned",
        destination: "SecretAdminCity",
        plan: { request: { origin: "Delhi", destination: "SecretAdminCity", budget: 99999 } },
      },
    ]);

    // Legacy feedback document without category field.
    await Feedback.collection.insertOne({
      userId: ashaUser._id,
      rating: 5,
      message: "Legacy entry",
      createdAt: new Date(),
    });

    await asha
      .post("/api/events/interaction")
      .send({ action: "map_style_changed", value: "satellite", path: "/trip/1" });
    await asha
      .post("/api/events/interaction")
      .send({ action: "trip_tab_viewed", value: "hotels", path: "/trip/1" });
    await asha
      .post("/api/events/interaction")
      .send({ action: "hotel_deal_clicked", value: "booking_url", path: "/trip/1" });
    await asha
      .post("/api/events/interaction")
      .send({ action: "brief_builder_submitted", path: "/trip/new" });

    const tripsRes = await admin.get("/api/stats/trips?days=30");
    expect(tripsRes.status).toBe(200);
    expect(tripsRes.body.trips.totalTrips).toBe(2);
    expect(tripsRes.body.trips.topDestinations[0]).toMatchObject({
      destination: "Goa",
      count: 1,
      avgBudgetInr: 40000,
    });
    expect(JSON.stringify(tripsRes.body.trips)).not.toContain("SecretAdminCity");
    expect(tripsRes.body.trips.destinationPins).toHaveLength(1);
    expect(tripsRes.body.trips.priceSourceCoverage).toMatchObject({
      liveHotels: 1,
      estimatedFlights: 1,
      liveOverallPct: 50,
    });
    expect(tripsRes.body.trips.planningHealth.topMissingFields.map((f) => f.field)).toEqual(
      expect.arrayContaining(["budget", "travel_style"])
    );

    const activityRes = await admin.get("/api/stats/activity?days=7");
    expect(activityRes.body.activity.featureEngagement.tripMap.totalInteractions).toBe(1);
    expect(activityRes.body.activity.featureEngagement.hotelOutbound).toMatchObject({
      bookingUrlClicks: 1,
      staysTabViews: 1,
      staysTabCtrPct: 100,
    });
    expect(activityRes.body.activity.featureEngagement.creationFlow.briefBuilderSubmitted).toBe(1);

    const retentionRes = await admin.get("/api/stats/retention?weeks=4");
    expect(retentionRes.status).toBe(200);
    expect(retentionRes.body.retention.cohorts).toHaveLength(4);
    expect((await admin.get("/api/stats/retention?weeks=1")).status).toBe(400);
    expect((await admin.get("/api/stats/retention?weeks=20")).status).toBe(400);
  });

  it("leaves non-INR trips out of INR budget averages and counts them", async () => {
    const ashaUser = await User.create({ name: "Asha", email: "asha@example.com", password: PASSWORD });
    const adminUser = await User.create({ name: "Admin", email: ADMIN_EMAIL, password: PASSWORD });
    const cookie = `token=${jwt.sign({ id: adminUser._id }, env.JWT_SECRET)}`;

    await Trip.create([
      {
        userId: ashaUser._id,
        status: "planned",
        destination: "Goa",
        plan: {
          request: { origin: "Ahmedabad", destination: "Goa", budget: 40000, currency: "INR" },
          estimated_cost: { hotel_total: 18000, travel_total: 10000, total: 28000, currency: "INR" },
        },
      },
      {
        userId: ashaUser._id,
        status: "planned",
        destination: "New York",
        plan: {
          request: { origin: "Los Angeles", destination: "New York", budget: 1000, currency: "USD" },
          estimated_cost: { hotel_total: 300, travel_total: 300, total: 600, currency: "USD" },
        },
      },
    ]);

    const tripsRes = await request(app).get("/api/stats/trips?days=30").set("Cookie", cookie);
    expect(tripsRes.status).toBe(200);
    expect(tripsRes.body.trips.budgetAnalysis.avgBudgetInr).toBe(40000);
    expect(tripsRes.body.trips.budgetAnalysis.nonInrTrips).toBe(1);

    const usersRes = await request(app).get("/api/stats/users").set("Cookie", cookie);
    expect(usersRes.body.users[0].avgBudgetInr).toBe(40000);
  });
});
