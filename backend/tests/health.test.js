import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../src/app.js";

describe("GET /health", () => {
  it("reports ok", async () => {
    const response = await request(app).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });

  it("is also served under /api, the only path Vercel routes to the backend", async () => {
    const response = await request(app).get("/api/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
  });
});

describe("CORS", () => {
  it("accepts a same-origin request from the domain serving the frontend", async () => {
    const response = await request(app)
      .get("/api/health")
      .set("Host", "voyagent-preview.vercel.app")
      .set("Origin", "https://voyagent-preview.vercel.app");

    expect(response.status).toBe(200);
  });

  it("rejects an origin that is neither the same site nor allowed", async () => {
    const response = await request(app)
      .get("/api/health")
      .set("Host", "voyagent-preview.vercel.app")
      .set("Origin", "https://evil.example");

    expect(response.status).toBe(403);
  });
});
