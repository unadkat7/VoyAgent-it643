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
