import nock from "nock";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { PlannerUnavailableError, requestPlan } from "../../src/clients/aiPlanner.client.js";

const AI = "http://ai-service.test";
const PLAN_PATH = "/planner/plan-trip";
const PLANNED = { status: "planned", plan: { request: { destination: "Goa" } } };
const CALL = { tripId: "t1", conversation: [{ role: "traveler", content: "Goa" }] };

const planner = () => nock(AI).post(PLAN_PATH);
// nock needs a real Error here; a plain object makes the request hang until it times out.
const connectionReset = () => Object.assign(new Error("socket hang up"), { code: "ECONNRESET" });

beforeAll(() => nock.disableNetConnect());
afterEach(() => nock.cleanAll());

// On Vercel a frozen function can wake with a dead keep-alive socket, or reach a cold ai-service.
describe("requestPlan on a serverless platform", () => {
  it("retries once when the connection is dropped", async () => {
    planner().replyWithError(connectionReset());
    planner().reply(200, PLANNED);

    const result = await requestPlan(CALL);

    expect(result.outcome).toBe("planned");
    expect(nock.isDone()).toBe(true);
  });

  it.each([502, 503, 504])("retries once when the ai-service answers %s", async (status) => {
    planner().reply(status, { detail: "cold start" });
    planner().reply(200, PLANNED);

    expect((await requestPlan(CALL)).outcome).toBe("planned");
  });

  it("gives up after the second failure", async () => {
    planner().twice().replyWithError(connectionReset());

    await expect(requestPlan(CALL)).rejects.toThrow(PlannerUnavailableError);
    expect(nock.isDone()).toBe(true);
  });

  it.each([400, 401, 500])("does not retry a %s answer", async (status) => {
    const first = planner().reply(status, {});
    const second = planner().reply(200, PLANNED);

    await expect(requestPlan(CALL)).rejects.toThrow(PlannerUnavailableError);
    expect(first.isDone()).toBe(true);
    expect(second.isDone()).toBe(false);
  });
});
