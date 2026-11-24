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

  it("refuses to re-plan a planned Trip: the chat edits it instead", async () => {
    const agent = await signedInAgent();
    aiAnswers(PLANNED);
    const planned = await agent.post("/api/trips/plan").send({ prompt: "full details" });

    const response = await agent
      .post("/api/trips/plan")
      .send({ prompt: "change it", tripId: planned.body.trip._id });

    expect(response.status).toBe(409);
  });

  it("ends the conversation with the plan's follow-up question", async () => {
    const agent = await signedInAgent();
    aiAnswers({ ...PLANNED, plan: { ...PLAN, follow_up: "Tell me your budget." } });

    const response = await agent.post("/api/trips/plan").send({ prompt: "Mumbai to Ooty" });

    expect(response.body.trip.conversation.at(-1)).toEqual({
      role: "assistant",
      content: "Tell me your budget.",
    });
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

describe("Chat about a planned Trip", () => {
  const EDIT_PATH = "/planner/edit-plan";
  const PLAN_WITH_OPTIONS = {
    ...PLAN,
    travel_options: [
      { mode: "train", label: "Train · 3AC", per_person_low: 3000, per_person_high: 4000, total: 7000 },
      { mode: "flight", label: "Flight · IndiGo", per_person_low: 5000, per_person_high: 5000, total: 10000 },
    ],
  };

  async function plannedTrip() {
    const agent = await signedInAgent();
    aiAnswers({ ...PLANNED, plan: PLAN_WITH_OPTIONS });
    const created = await agent.post("/api/trips/plan").send({ prompt: "Goa" });
    return { agent, tripId: created.body.trip._id };
  }

  function editAnswers(body, status = 200) {
    let sent;
    nock(AI, { reqheaders: { "x-internal-key": "test-internal-key" } })
      .post(EDIT_PATH, (request) => {
        sent = request;
        return true;
      })
      .reply(status, body);
    return () => sent;
  }

  it("answers a question without changing the plan", async () => {
    const { agent, tripId } = await plannedTrip();
    const sent = editAnswers({ outcome: "answered", change: "question", reply: "Try Panjim." });

    const response = await agent.post(`/api/trips/${tripId}/chat`).send({ message: "Where to eat?" });

    expect(response.status).toBe(200);
    expect(response.body.outcome).toBe("answered");
    expect(response.body.trip.plan.summary).toBe("Three beach days.");
    expect(response.body.trip.conversation.slice(-2)).toEqual([
      { role: "traveler", content: "Where to eat?" },
      { role: "assistant", content: "Try Panjim." },
    ]);
    expect(sent().plan.summary).toBe("Three beach days.");
    expect(sent().conversation.at(-1)).toEqual({ role: "traveler", content: "Where to eat?" });
    const edited = await Event.findOne({ type: "trip_plan_edited" }).lean();
    expect(edited.meta).toMatchObject({ outcome: "answered", change: "question" });
    expect(await Event.countDocuments({ type: "trip_planned" })).toBe(1);
  });

  it("saves an edited plan and sends the picked travel mode", async () => {
    const { agent, tripId } = await plannedTrip();
    await agent.patch(`/api/trips/${tripId}`).send({ travelMode: "flight" });
    const sent = editAnswers({
      outcome: "updated",
      change: "request",
      reply: "Updated the plan for 4 days.",
      plan: { ...PLAN_WITH_OPTIONS, summary: "Four beach days." },
    });

    const response = await agent.post(`/api/trips/${tripId}/chat`).send({ message: "4 days" });

    expect(response.body.trip.plan.summary).toBe("Four beach days.");
    expect(response.body.trip.travelMode).toBe("flight");
    expect(sent().travel_mode).toBe("flight");
  });

  it("forgets a picked travel mode the new plan no longer has", async () => {
    const { agent, tripId } = await plannedTrip();
    await agent.patch(`/api/trips/${tripId}`).send({ travelMode: "flight" });
    editAnswers({
      outcome: "updated",
      change: "request",
      reply: "Updated.",
      plan: { ...PLAN, travel_options: [PLAN_WITH_OPTIONS.travel_options[0]] },
    });

    const response = await agent.post(`/api/trips/${tripId}/chat`).send({ message: "no flights" });

    expect(response.body.trip.travelMode).toBeUndefined();
  });

  it("keeps everything as it was when the planner is down", async () => {
    const { agent, tripId } = await plannedTrip();
    editAnswers({ detail: "planning_unavailable" }, 503);
    editAnswers({ detail: "planning_unavailable" }, 503);

    const response = await agent.post(`/api/trips/${tripId}/chat`).send({ message: "4 days" });

    expect(response.status).toBe(503);
    const saved = await Trip.findById(tripId);
    expect(saved.conversation.map((turn) => turn.content)).toEqual(["Goa", expect.any(String)]);
    expect(await Event.countDocuments({ type: "trip_plan_edit_failed" })).toBe(1);
  });

  it("refuses chat edits while the plan is Final, and allows them again in Draft", async () => {
    const { agent, tripId } = await plannedTrip();
    await agent.patch(`/api/trips/${tripId}`).send({ finalized: true });

    expect((await agent.post(`/api/trips/${tripId}/chat`).send({ message: "4 days" })).status).toBe(
      409
    );

    await agent.patch(`/api/trips/${tripId}`).send({ finalized: false });
    editAnswers({ outcome: "answered", change: "question", reply: "Sure." });
    expect((await agent.post(`/api/trips/${tripId}/chat`).send({ message: "hi" })).status).toBe(200);
  });

  it("refuses chat on a Trip that has no plan yet", async () => {
    const agent = await signedInAgent();
    aiAnswers(CLARIFICATION);
    const draft = await agent.post("/api/trips/plan").send({ prompt: "Goa" });

    const response = await agent.post(`/api/trips/${draft.body.trip._id}/chat`).send({ message: "hi" });

    expect(response.status).toBe(409);
  });

  it.each([
    ["an unknown travel mode", { travelMode: "boat" }],
    ["a mode this plan does not have", { travelMode: "car" }],
    ["an unknown field", { status: "draft" }],
    ["nothing", {}],
  ])("rejects a PATCH with %s", async (_label, body) => {
    const { agent, tripId } = await plannedTrip();

    expect((await agent.patch(`/api/trips/${tripId}`).send(body)).status).toBe(400);
  });

  it("rejects an empty or very long chat message", async () => {
    const { agent, tripId } = await plannedTrip();

    expect((await agent.post(`/api/trips/${tripId}/chat`).send({ message: " " })).status).toBe(400);
    expect(
      (await agent.post(`/api/trips/${tripId}/chat`).send({ message: "x".repeat(1001) })).status
    ).toBe(400);
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
    ["chat about", (agent, id) => agent.post(`/api/trips/${id}/chat`).send({ message: "hi" })],
    ["finalize", (agent, id) => agent.patch(`/api/trips/${id}`).send({ finalized: true })],
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
