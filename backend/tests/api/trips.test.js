import nock from "nock";
import request from "supertest";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import app from "../../src/app.js";
import Event from "../../src/models/event.model.js";
import Trip from "../../src/models/trip.model.js";
import { signedInAgent } from "../helpers.js";

const AI = "http://ai-service.test";
const PLAN_PATH = "/planner/plan-trip";

const CLARIFICATION = {
  status: "needs_clarification",
  trip_id: "ignored",
  clarification: { missing_fields: ["budget"], question: "What is your total Budget?" },
  plan: null,
};
const PLAN = {
  summary: "Three beach days.",
  important_tips: ["Carry sunscreen"],
  request: { destination: "Goa", origin: "Ahmedabad" },
  hotels: [],
  flights: [],
  itinerary: [],
  estimated_cost: { hotel_total: 9000, flight_total: 10000, total: 19000, currency: "INR" },
  notes: [],
};
const PLANNED = { status: "planned", trip_id: "ignored", clarification: null, plan: PLAN };

// Stub for the Planning Engine (an incoming answer), matched only with the internal key.
function aiAnswers(body, status = 200) {
  return nock(AI, { reqheaders: { "x-internal-key": "test-internal-key" } })
    .post(PLAN_PATH)
    .reply(status, body);
}

beforeAll(() => {
  nock.disableNetConnect();
  nock.enableNetConnect((host) => host.startsWith("127.0.0.1") || host.startsWith("localhost"));
});

afterEach(() => nock.cleanAll());

describe("POST /api/trips/plan", () => {
  it("starts a Draft Trip when the Planning Engine asks for clarification", async () => {
    const agent = await signedInAgent();
    aiAnswers(CLARIFICATION);

    const response = await agent.post("/api/trips/plan").send({ prompt: "Goa with my wife" });

    expect(response.status).toBe(200);
    expect(response.body.trip.status).toBe("draft");
    expect(response.body.trip.clarification).toEqual({
      missingFields: ["budget"],
      question: "What is your total Budget?",
    });
    expect(response.body.trip.conversation).toEqual([
      { role: "traveler", content: "Goa with my wife" },
      { role: "assistant", content: "What is your total Budget?" },
    ]);
  });

  it("continues the same Trip and sends the whole conversation", async () => {
    const agent = await signedInAgent();
    aiAnswers(CLARIFICATION);
    const first = await agent.post("/api/trips/plan").send({ prompt: "Goa with my wife" });
    let sentToPlanner;
    nock(AI)
      .post(PLAN_PATH, (body) => {
        sentToPlanner = body;
        return true;
      })
      .reply(200, PLANNED);

    const response = await agent
      .post("/api/trips/plan")
      .send({ prompt: "40k total", tripId: first.body.trip._id });

    expect(response.status).toBe(200);
    expect(response.body.trip.status).toBe("planned");
    expect(response.body.trip.plan.summary).toBe("Three beach days.");
    expect(response.body.trip.destination).toBe("Goa");
    expect(sentToPlanner.trip_id).toBe(first.body.trip._id);
    expect(sentToPlanner.conversation.map((turn) => turn.role)).toEqual([
      "traveler",
      "assistant",
      "traveler",
    ]);
  });

  it("refuses to re-plan a planned Trip", async () => {
    const agent = await signedInAgent();
    aiAnswers(PLANNED);
    const planned = await agent.post("/api/trips/plan").send({ prompt: "full details" });

    const response = await agent
      .post("/api/trips/plan")
      .send({ prompt: "change it", tripId: planned.body.trip._id });

    expect(response.status).toBe(409);
  });

  it.each([
    ["is down", () => aiAnswers({ detail: "planning_unavailable" }, 503)],
    ["answers nonsense", () => aiAnswers({ status: "booked" })],
  ])("records planning_failed when the Planning Engine %s", async (_label, stub) => {
    const agent = await signedInAgent();
    stub();

    const response = await agent.post("/api/trips/plan").send({ prompt: "Goa" });

    expect(response.status).toBe(503);
    const saved = await Trip.findById(response.body.tripId);
    expect(saved.status).toBe("planning_failed");
  });

  it("records each planning step as an Event", async () => {
    const agent = await signedInAgent();
    aiAnswers(PLANNED);
    const planned = await agent.post("/api/trips/plan").send({ prompt: "Goa" });
    aiAnswers({ detail: "planning_unavailable" }, 503);
    await agent.post("/api/trips/plan").send({ prompt: "Manali" });
    await agent.get(`/api/trips/${planned.body.trip._id}`);

    const types = (await Event.find({ type: { $ne: "signup" } }).sort({ _id: 1 }).lean()).map(
      (event) => event.type
    );
    expect(types).toEqual([
      "trip_plan_requested",
      "trip_planned",
      "trip_plan_requested",
      "trip_plan_failed",
      "trip_viewed",
    ]);
  });

  it.each([
    ["an empty prompt", { prompt: "   " }],
    ["a very long prompt", { prompt: "x".repeat(2001) }],
    ["a bad trip id", { prompt: "hi", tripId: "123" }],
  ])("rejects %s", async (_label, body) => {
    const agent = await signedInAgent();

    expect((await agent.post("/api/trips/plan").send(body)).status).toBe(400);
  });

  it("needs a session", async () => {
    expect((await request(app).post("/api/trips/plan").send({ prompt: "Goa" })).status).toBe(401);
  });
});

describe("Rule 5: only the owner can use a Trip", () => {
  async function tripOwnedByAsha() {
    const asha = await signedInAgent("asha@example.com");
    aiAnswers(CLARIFICATION);
    const created = await asha.post("/api/trips/plan").send({ prompt: "Goa" });
    const ravi = await signedInAgent("ravi@example.com", "Ravi");
    return { asha, ravi, tripId: created.body.trip._id };
  }

  it("lets the owner read the Trip", async () => {
    const { asha, tripId } = await tripOwnedByAsha();

    expect((await asha.get(`/api/trips/${tripId}`)).status).toBe(200);
  });

  it.each([
    ["read", (agent, id) => agent.get(`/api/trips/${id}`)],
    ["delete", (agent, id) => agent.delete(`/api/trips/${id}`)],
    ["continue", (agent, id) => agent.post("/api/trips/plan").send({ prompt: "hi", tripId: id })],
  ])("forbids another account to %s it", async (_action, act) => {
    const { ravi, tripId } = await tripOwnedByAsha();

    expect((await act(ravi, tripId)).status).toBe(403);
    expect(await Trip.findById(tripId)).not.toBeNull();
  });

  it("returns 404 for a Trip that does not exist and 400 for a malformed id", async () => {
    const agent = await signedInAgent();

    expect((await agent.get("/api/trips/64b000000000000000000000")).status).toBe(404);
    expect((await agent.get("/api/trips/not-an-id")).status).toBe(400);
  });

  it("lists only the signed-in account's Trips, newest first", async () => {
    const { asha, ravi } = await tripOwnedByAsha();
    aiAnswers(CLARIFICATION);
    await asha.post("/api/trips/plan").send({ prompt: "Manali" });

    const ashaTrips = await asha.get("/api/trips");
    const raviTrips = await ravi.get("/api/trips");

    expect(ashaTrips.body.trips.map((t) => t.conversation[0].content)).toEqual(["Manali", "Goa"]);
    expect(raviTrips.body.trips).toEqual([]);
  });

  it("lets the owner delete the Trip", async () => {
    const { asha, tripId } = await tripOwnedByAsha();

    expect((await asha.delete(`/api/trips/${tripId}`)).status).toBe(200);
    expect(await Trip.findById(tripId)).toBeNull();
  });
});
