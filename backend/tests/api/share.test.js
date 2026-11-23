import nock from "nock";
import request from "supertest";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import app from "../../src/app.js";
import Event from "../../src/models/event.model.js";
import { adminAgent, signedInAgent } from "../helpers.js";

const AI = "http://ai-service.test";
const PLAN = {
  summary: "Three beach days.",
  request: { destination: "Goa" },
  hotels: [],
  flights: [],
  itinerary: [],
};

function aiAnswers(body) {
  return nock(AI).post("/planner/plan-trip").reply(200, body);
}

async function plannedTrip(agent) {
  aiAnswers({ status: "planned", plan: PLAN });
  return (await agent.post("/api/trips/plan").send({ prompt: "Goa" })).body.trip;
}

beforeAll(() => {
  nock.disableNetConnect();
  nock.enableNetConnect((host) => host.startsWith("127.0.0.1") || host.startsWith("localhost"));
});

afterEach(() => nock.cleanAll());

describe("POST /api/trips/:id/share", () => {
  it("gives the owner a link id that stays the same when shared again", async () => {
    const asha = await signedInAgent();
    const trip = await plannedTrip(asha);

    const first = await asha.post(`/api/trips/${trip._id}/share`).send({});
    const second = await asha.post(`/api/trips/${trip._id}/share`).send({});

    expect(first.status).toBe(200);
    expect(first.body.shareId).toMatch(/^[\w-]{16}$/);
    expect(second.body.shareId).toBe(first.body.shareId);
    expect(await Event.countDocuments({ type: "trip_shared" })).toBe(2);
  });

  it("refuses a Trip that is not planned yet", async () => {
    const asha = await signedInAgent();
    aiAnswers({ status: "needs_clarification", clarification: { missing_fields: ["budget"], question: "Budget?" } });
    const draft = (await asha.post("/api/trips/plan").send({ prompt: "Goa" })).body.trip;

    expect((await asha.post(`/api/trips/${draft._id}/share`).send({})).status).toBe(409);
  });

  it("forbids another account to share it (Rule 5)", async () => {
    const trip = await plannedTrip(await signedInAgent());
    const ravi = await signedInAgent("ravi@example.com", "Ravi");

    expect((await ravi.post(`/api/trips/${trip._id}/share`).send({})).status).toBe(403);
  });
});

describe("GET /api/public/trips/:shareId", () => {
  it("shows the plan to anyone, without the conversation or the owner, and counts the view", async () => {
    const asha = await signedInAgent();
    const trip = await plannedTrip(asha);
    const { shareId } = (await asha.post(`/api/trips/${trip._id}/share`).send({})).body;

    const response = await request(app).get(`/api/public/trips/${shareId}`);
    await request(app).get(`/api/public/trips/${shareId}`);

    expect(response.status).toBe(200);
    expect(response.body.trip).toMatchObject({ destination: "Goa", plan: { summary: "Three beach days." } });
    expect(response.body.trip.conversation).toBeUndefined();
    expect(response.body.trip.userId).toBeUndefined();
    expect((await asha.get(`/api/trips/${trip._id}`)).body.trip.shareViews).toBe(2);
    expect(await Event.countDocuments({ type: "shared_trip_viewed" })).toBe(2);
  });

  it("stops working once the owner removes the link", async () => {
    const asha = await signedInAgent();
    const trip = await plannedTrip(asha);
    const { shareId } = (await asha.post(`/api/trips/${trip._id}/share`).send({})).body;

    expect((await asha.delete(`/api/trips/${trip._id}/share`)).status).toBe(200);
    expect((await request(app).get(`/api/public/trips/${shareId}`)).status).toBe(404);
  });

  it.each(["AAAAAAAAAAAAAAAA", "short", "has spaces in it!"])(
    "returns 404 for the unknown link %s",
    async (shareId) => {
      expect((await request(app).get(`/api/public/trips/${encodeURIComponent(shareId)}`)).status).toBe(404);
    }
  );

  it("lists the most viewed shared Trips for admins", async () => {
    const asha = await signedInAgent();
    const trip = await plannedTrip(asha);
    const { shareId } = (await asha.post(`/api/trips/${trip._id}/share`).send({})).body;
    await request(app).get(`/api/public/trips/${shareId}`);
    const admin = await adminAgent();

    const { activity } = (await admin.get("/api/stats/activity")).body;

    expect(activity.topShared).toEqual([{ destination: "Goa", shareViews: 1 }]);
  });
});
