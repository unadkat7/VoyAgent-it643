import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../../src/app.js";

// Own file: vitest gives each file fresh modules, so this limiter count starts at zero.
describe("login rate limit", () => {
  it("allows 10 attempts per window and blocks the 11th", async () => {
    const attempt = () =>
      request(app).post("/api/auth/login").send({ email: "x@example.com", password: "whatever1" });

    for (let i = 0; i < 10; i += 1) {
      expect((await attempt()).status).toBe(401);
    }
    expect((await attempt()).status).toBe(429);
  });
});
