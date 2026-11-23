import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import app from "../../src/app.js";
import Event from "../../src/models/event.model.js";
import Feedback from "../../src/models/feedback.model.js";
import User from "../../src/models/user.model.js";
import { deviceFrom, ipPrefix, referrerHost } from "../../src/services/telemetry.service.js";
import { signedInAgent } from "../helpers.js";

const PHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1";

afterEach(() => vi.restoreAllMocks());

describe("ipPrefix", () => {
  it.each([
    ["103.21.45.17", "103.21.45.0"],
    ["::ffff:10.1.2.3", "10.1.2.0"],
    ["2401:4900:1c2a:5f00::1", "2401:4900:1c2a::"],
    ["::1", "0:0:0::"],
    [undefined, null],
  ])("keeps only the network part of %s", (ip, expected) => {
    expect(ipPrefix(ip)).toBe(expected);
  });
});

describe("deviceFrom", () => {
  it("reads device type, OS and browser from the user agent", () => {
    expect(deviceFrom(PHONE_UA)).toEqual({ type: "mobile", os: "iOS", browser: "Mobile Safari" });
  });

  it("calls a user agent without a device type a desktop", () => {
    expect(deviceFrom("").type).toBe("desktop");
  });
});

describe("recorded Events", () => {
  it("records a signup with the account, network and location, never the full IP", async () => {
    await request(app)
      .post("/api/auth/signup")
      .set("User-Agent", PHONE_UA)
      .set("X-Forwarded-For", "103.21.45.17")
      .set("X-Vercel-IP-Country", "IN")
      .set("X-Vercel-IP-City", "Ahmedabad")
      .send({ name: "Asha", email: "asha@example.com", password: "correct-horse-battery" });

    const event = await Event.findOne({ type: "signup" }).lean();
    expect(event).toMatchObject({
      ipPrefix: "103.21.45.0",
      country: "IN",
      city: "Ahmedabad",
      device: { type: "mobile", os: "iOS" },
    });
    expect(event.userId).toBeDefined();
    expect(JSON.stringify(event)).not.toContain("103.21.45.17");
  });

  it("records logins and feedback for the signed-in account", async () => {
    const agent = await signedInAgent();
    await agent.post("/api/auth/login").send({ email: "asha@example.com", password: "correct-horse-battery" });
    await agent.post("/api/feedback").send({ rating: 5 });

    const types = (await Event.find().lean()).map((event) => event.type);
    expect(types).toEqual(expect.arrayContaining(["signup", "login", "feedback_submitted"]));
  });

  it("does not fail the request when the Event cannot be stored", async () => {
    vi.spyOn(Event, "create").mockRejectedValue(new Error("db down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await request(app)
      .post("/api/auth/signup")
      .send({ name: "Asha", email: "asha@example.com", password: "correct-horse-battery" });

    expect(response.status).toBe(201);
    expect(console.error).toHaveBeenCalled();
  });
});

describe("POST /api/events/pageview", () => {
  it("records a page view without a session", async () => {
    const response = await request(app).post("/api/events/pageview").send({ path: "/" });

    expect(response.status).toBe(204);
    const event = await Event.findOne({ type: "pageview" }).lean();
    expect(event).toMatchObject({ path: "/" });
    expect(event.visitorHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("links the page view to the account when signed in", async () => {
    const agent = await signedInAgent();

    await agent.post("/api/events/pageview").send({ path: "/dashboard" });

    expect((await Event.findOne({ type: "pageview" }).lean()).userId).toBeDefined();
  });

  it.each(["dashboard", "https://evil.test/", "/" + "a".repeat(250)])(
    "rejects the path %s",
    async (path) => {
      expect((await request(app).post("/api/events/pageview").send({ path })).status).toBe(400);
    }
  );

  it("skips known bots", async () => {
    await request(app)
      .post("/api/events/pageview")
      .set("User-Agent", "Googlebot/2.1 (+http://www.google.com/bot.html)")
      .send({ path: "/" });

    expect(await Event.countDocuments()).toBe(0);
  });

  it("strips referrer paths and ignores same-origin referrers", async () => {
    await request(app)
      .post("/api/events/pageview")
      .set("Host", "voyagent.test")
      .send({ path: "/", referrer: "https://www.google.com/search?q=goa+trip&secret=1" });

    const event = await Event.findOne({ type: "pageview" }).lean();
    expect(event.referrer).toBe("google.com");
    expect(referrerHost("https://voyagent.test/dashboard", "voyagent.test")).toBeNull();
    expect(referrerHost("share_link", "voyagent.test")).toBe("share_link");
    expect(referrerHost("javascript:alert(1)", "voyagent.test")).toBeNull();
  });
});

describe("POST /api/events/interaction", () => {
  it("records whitelisted TripMap and dossier interactions without PII", async () => {
    const response = await request(app).post("/api/events/interaction").send({
      action: "map_style_changed",
      value: "satellite",
      path: "/share/abc1234567890123",
    });

    expect(response.status).toBe(204);
    const event = await Event.findOne({ type: "feature_interaction" }).lean();
    expect(event).toMatchObject({
      type: "feature_interaction",
      path: "/share/abc1234567890123",
      meta: { action: "map_style_changed", value: "satellite" },
    });
  });

  it("rejects unknown actions or free-text values", async () => {
    expect(
      (await request(app).post("/api/events/interaction").send({ action: "raw_prompt" })).status
    ).toBe(400);
    expect(
      (
        await request(app)
          .post("/api/events/interaction")
          .send({ action: "map_style_changed", value: "has spaces & chars" })
      ).status
    ).toBe(400);
  });

  it("persists feedback category and signup source safely", async () => {
    const agent = request.agent(app);
    await agent.post("/api/auth/signup").send({
      name: "Meera",
      email: "meera@example.com",
      password: "correct-horse-battery",
      signupSource: "share_link",
    });
    await agent
      .post("/api/feedback")
      .send({ rating: 5, message: "Love the map", page: "/trip/1", category: "map" });

    const user = await User.findOne({ email: "meera@example.com" }).lean();
    const feedback = await Feedback.findOne({ userId: user._id }).lean();
    expect(user.signupSource).toBe("share_link");
    expect(user.lastLoginAt).toBeDefined();
    expect(feedback.category).toBe("map");
  });
});
