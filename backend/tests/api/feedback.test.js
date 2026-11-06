import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../../src/app.js";
import { signedInAgent } from "../helpers.js";

describe("POST /api/feedback", () => {
  it("stores a rating with an optional message", async () => {
    const agent = await signedInAgent();

    const response = await agent
      .post("/api/feedback")
      .send({ rating: 5, message: "Loved the Goa plan", page: "/trip/123" });

    expect(response.status).toBe(201);
  });

  it.each([0, 6, 3.5])("rejects a rating of %s", async (rating) => {
    const agent = await signedInAgent();

    expect((await agent.post("/api/feedback").send({ rating })).status).toBe(400);
  });

  it("needs a session", async () => {
    expect((await request(app).post("/api/feedback").send({ rating: 4 })).status).toBe(401);
  });
});

describe("GET /api/stats", () => {
  it("is only for admins", async () => {
    const agent = await signedInAgent("asha@example.com");

    expect((await agent.get("/api/stats")).status).toBe(403);
  });

  it("counts Travelers, Trips and feedback for an admin", async () => {
    const traveler = await signedInAgent("asha@example.com");
    await traveler.post("/api/feedback").send({ rating: 4 });
    await traveler.post("/api/feedback").send({ rating: 2 });
    const admin = await signedInAgent("admin@voyagent.test", "Admin");

    const response = await admin.get("/api/stats");

    expect(response.status).toBe(200);
    expect(response.body.stats).toMatchObject({
      accounts: 2,
      trips: 0,
      plannedTrips: 0,
      feedbackCount: 2,
      averageRating: 3,
    });
  });
});
