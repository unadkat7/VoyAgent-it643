import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../../src/app.js";
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

describe.each(["/api/stats", "/api/stats/users", "/api/stats/activity", "/api/stats/feedback"])(
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

    const { feedback } = (await admin.get("/api/stats/feedback")).body;

    expect(feedback).toHaveLength(1);
    expect(feedback[0]).toMatchObject({ rating: 4, message: "Loved it", page: "/dashboard" });
    expect(feedback[0].userId).toBeUndefined();
  });
});
