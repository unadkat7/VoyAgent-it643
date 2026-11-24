import axios from "axios";
import { z } from "zod";
import { env } from "../config/env.js";

const PLAN_TIMEOUT_MS = 120_000;

export class PlannerUnavailableError extends Error {}

const describe = (error) => error.response?.status ?? error.code ?? error.message;
const unavailable = (error) =>
  new PlannerUnavailableError(`Planning Engine request failed: ${describe(error)}`);

const plannerResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("needs_clarification"),
    clarification: z.object({
      missing_fields: z.array(z.string()),
      question: z.string().min(1),
      reason: z.string().nullish(),
    }),
  }),
  z.object({
    status: z.literal("planned"),
    plan: z.looseObject({
      request: z.looseObject({ destination: z.string().nullish() }),
    }),
  }),
]);

const RETRY_DELAY_MS = 500;
const RETRYABLE_STATUS = new Set([502, 503, 504]);

// On Vercel a frozen function can wake with a dead keep-alive socket, or reach a still-starting
// ai-service. Both fail fast and succeed on the next try; anything else is a real failure.
const isTransient = (error) =>
  error.response ? RETRYABLE_STATUS.has(error.response.status) : error.code !== "ECONNABORTED";

function post(path, body) {
  return axios.post(`${env.AI_SERVICE_URL}/planner/${path}`, body, {
    headers: { "X-Internal-Key": env.INTERNAL_API_KEY },
    timeout: PLAN_TIMEOUT_MS,
  });
}

async function postWithRetry(path, body) {
  try {
    return (await post(path, body)).data;
  } catch (firstError) {
    if (!isTransient(firstError)) {
      throw unavailable(firstError);
    }
    console.warn(`Planning Engine request failed, retrying once: ${describe(firstError)}`);
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    try {
      return (await post(path, body)).data;
    } catch (secondError) {
      throw unavailable(secondError);
    }
  }
}

const wireTurns = (conversation) => conversation.map(({ role, content }) => ({ role, content }));

// Adapter for the Planning Engine (ai-service). The rest of the backend never sees its wire format.
export async function requestPlan({ tripId, conversation }) {
  const data = await postWithRetry("plan-trip", {
    trip_id: tripId,
    conversation: wireTurns(conversation),
  });

  const parsed = plannerResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new PlannerUnavailableError("Planning Engine sent an unexpected response");
  }

  const result = parsed.data;
  if (result.status === "needs_clarification") {
    return {
      outcome: "needs_clarification",
      clarification: {
        missingFields: result.clarification.missing_fields,
        question: result.clarification.question,
        reason: result.clarification.reason ?? null,
      },
    };
  }
  return { outcome: "planned", plan: result.plan };
}

const editResponseSchema = z.object({
  outcome: z.enum(["updated", "answered", "needs_clarification"]),
  change: z.enum(["request", "itinerary", "question"]),
  reply: z.string().min(1),
  reason: z.string().nullish(),
  plan: z.looseObject({ request: z.looseObject({ destination: z.string().nullish() }) }).nullish(),
});

// One chat message about a planned Trip: the planner answers it or returns an edited plan.
export async function requestEdit({ tripId, conversation, plan, travelMode }) {
  const data = await postWithRetry("edit-plan", {
    trip_id: tripId,
    conversation: wireTurns(conversation),
    plan,
    travel_mode: travelMode ?? null,
  });
  const parsed = editResponseSchema.safeParse(data);
  if (!parsed.success || (parsed.data.outcome === "updated" && !parsed.data.plan)) {
    throw new PlannerUnavailableError("Planning Engine sent an unexpected edit response");
  }
  const { outcome, change, reply, reason, plan: newPlan } = parsed.data;
  return { outcome, change, reply, reason: reason ?? null, plan: newPlan ?? null };
}
