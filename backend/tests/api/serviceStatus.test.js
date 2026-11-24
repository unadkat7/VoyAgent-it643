import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../../src/app.js";
import ServiceStatus from "../../src/models/serviceStatus.model.js";
import Trip from "../../src/models/trip.model.js";
import User from "../../src/models/user.model.js";
import { adminAgent, signedInAgent } from "../helpers.js";

describe("service status API and availability guard", () => {
  it("returns operational by default on public GET /api/status", async () => {
    const res = await request(app).get("/api/status");

    expect(res.status).toBe(200);
    expect(res.body.status).toMatchObject({
      isDown: false,
      availableAt: null,
      resumingProvider: null,
    });
  });

  it("restricts PUT /api/status to admins", async () => {
    const traveler = await signedInAgent();
    const future = new Date(Date.now() + 3600_000).toISOString();

    expect((await request(app).put("/api/status").send({ isDown: true, groqResetAt: future })).status).toBe(401);
    expect((await traveler.put("/api/status").send({ isDown: true, groqResetAt: future })).status).toBe(403);
  });

  it("rejects past reset timestamps when publishing downtime", async () => {
    const admin = await adminAgent();
    const past = new Date(Date.now() - 60_000).toISOString();

    const res = await admin.put("/api/status").send({
      isDown: true,
      groqResetAt: past,
    });

    expect(res.status).toBe(400);
  });

  it("publishes downtime, blocks AI planning & chat with 503, and keeps saved/shared trips readable", async () => {
    const admin = await adminAgent();
    const traveler = await signedInAgent("asha@example.com");
    const ashaUser = await User.findOne({ email: "asha@example.com" });

    const trip = await Trip.create({
      userId: ashaUser._id,
      destination: "Goa",
      status: "planned",
      conversation: [{ role: "traveler", content: "Plan Goa" }],
      plan: { request: { destination: "Goa" }, summary: "Beach trip" },
    });

    const groqResetAt = new Date(Date.now() + 2 * 3600_000).toISOString();
    const cloudflareResetAt = new Date(Date.now() + 4 * 3600_000).toISOString();

    const publish = await admin.put("/api/status").send({
      isDown: true,
      groqResetAt,
      cloudflareResetAt,
      message: "Both AI providers reached their daily quota.",
    });

    expect(publish.status).toBe(200);
    expect(publish.body.status).toMatchObject({
      isDown: true,
      groqResetAt,
      cloudflareResetAt,
      availableAt: groqResetAt,
      resumingProvider: "groq",
      message: "Both AI providers reached their daily quota.",
    });

    // Public status reflects downtime.
    const statusRes = await request(app).get("/api/status");
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.status.isDown).toBe(true);
    expect(statusRes.body.status.availableAt).toBe(groqResetAt);

    // AI planning & chat endpoints return 503 AI_LIMIT_REACHED.
    const planRes = await traveler.post("/api/trips/plan").send({ prompt: "Mumbai to Goa" });
    expect(planRes.status).toBe(503);
    expect(planRes.body.code).toBe("AI_LIMIT_REACHED");
    expect(planRes.body.status.availableAt).toBe(groqResetAt);

    const chatRes = await traveler
      .post(`/api/trips/${trip._id}/chat`)
      .send({ message: "Make it cheaper" });
    expect(chatRes.status).toBe(503);
    expect(chatRes.body.code).toBe("AI_LIMIT_REACHED");

    // Existing saved trips and public shared trips stay accessible.
    expect((await traveler.get("/api/trips")).status).toBe(200);
    expect((await traveler.get(`/api/trips/${trip._id}`)).status).toBe(200);
    const shareRes = await traveler.post(`/api/trips/${trip._id}/share`).send({});
    expect(shareRes.status).toBe(200);
    expect((await request(app).get(`/api/public/trips/${shareRes.body.shareId}`)).status).toBe(200);

    // Admin can restore early at any time.
    const restore = await admin.put("/api/status").send({ isDown: false });
    expect(restore.status).toBe(200);
    expect(restore.body.status.isDown).toBe(false);
    expect((await request(app).get("/api/status")).body.status.isDown).toBe(false);
  });

  it("auto-clears expired downtime without manual admin intervention", async () => {
    await ServiceStatus.create({
      key: "global",
      isDown: true,
      message: "Expired outage",
      groqResetAt: new Date(Date.now() - 10_000),
      cloudflareResetAt: new Date(Date.now() + 3600_000),
    });

    const res = await request(app).get("/api/status");
    expect(res.status).toBe(200);
    expect(res.body.status.isDown).toBe(false);

    const stored = await ServiceStatus.findOne({ key: "global" }).lean();
    expect(stored.isDown).toBe(false);
  });
});
