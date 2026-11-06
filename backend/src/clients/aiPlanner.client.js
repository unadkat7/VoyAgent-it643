import axios from "axios";
import { z } from "zod";
import { env } from "../config/env.js";

const PLAN_TIMEOUT_MS = 120_000;

export class PlannerUnavailableError extends Error {}

const plannerResponseSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("needs_clarification"),
    clarification: z.object({
      missing_fields: z.array(z.string()),
      question: z.string().min(1),
    }),
  }),
  z.object({
    status: z.literal("planned"),
    plan: z.looseObject({
      request: z.looseObject({ destination: z.string().nullish() }),
    }),
  }),
]);

// Adapter for the Planning Engine (ai-service). The rest of the backend never sees its wire format.
export async function requestPlan({ tripId, conversation }) {
  let data;
  try {
    const response = await axios.post(
      `${env.AI_SERVICE_URL}/planner/plan-trip`,
      {
        trip_id: tripId,
        conversation: conversation.map(({ role, content }) => ({ role, content })),
      },
      {
        headers: { "X-Internal-Key": env.INTERNAL_API_KEY },
        timeout: PLAN_TIMEOUT_MS,
      }
    );
    data = response.data;
  } catch (error) {
    throw new PlannerUnavailableError(
      `Planning Engine request failed: ${error.response?.status ?? error.code ?? error.message}`
    );
  }

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
      },
    };
  }
  return { outcome: "planned", plan: result.plan };
}
