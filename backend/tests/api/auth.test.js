import request from "supertest";
import { describe, expect, it } from "vitest";
import app from "../../src/app.js";
import { PASSWORD, signedInAgent } from "../helpers.js";

const VALID = { name: "Asha", email: "asha@example.com", password: PASSWORD };

describe("POST /api/auth/signup", () => {
  it("creates the account, sets an httpOnly cookie and never returns the password", async () => {
    const response = await request(app).post("/api/auth/signup").send(VALID);

    expect(response.status).toBe(201);
    expect(response.body.user).toEqual({
      _id: expect.any(String),
      name: "Asha",
      email: VALID.email,
      isAdmin: false,
    });
    expect(JSON.stringify(response.body)).not.toContain(PASSWORD);
    expect(response.headers["set-cookie"][0]).toMatch(/token=.+HttpOnly/);
  });

  it.each([
    ["a bad email", { ...VALID, email: "not-an-email" }, "email"],
    ["a 7-character password", { ...VALID, password: "1234567" }, "password"],
    ["a 1-character name", { ...VALID, name: "A" }, "name"],
  ])("rejects %s with a field error", async (_label, body, field) => {
    const response = await request(app).post("/api/auth/signup").send(body);

    expect(response.status).toBe(400);
    expect(response.body.errors[field]).toBeDefined();
  });

  it("accepts the shortest allowed password (8 characters)", async () => {
    const response = await request(app)
      .post("/api/auth/signup")
      .send({ ...VALID, password: "12345678" });

    expect(response.status).toBe(201);
  });

  it("refuses a second account with the same email, whatever its case", async () => {
    await request(app).post("/api/auth/signup").send(VALID);

    const response = await request(app)
      .post("/api/auth/signup")
      .send({ ...VALID, email: "ASHA@example.com" });

    expect(response.status).toBe(409);
  });
});

describe("POST /api/auth/login", () => {
  it("signs in with the right password", async () => {
    await request(app).post("/api/auth/signup").send(VALID);

    const response = await request(app)
      .post("/api/auth/login")
      .send({ email: VALID.email, password: PASSWORD });

    expect(response.status).toBe(200);
    expect(response.headers["set-cookie"][0]).toMatch(/token=/);
  });

  it("gives the same answer for a wrong password and an unknown email", async () => {
    await request(app).post("/api/auth/signup").send(VALID);

    const wrongPassword = await request(app)
      .post("/api/auth/login")
      .send({ email: VALID.email, password: "wrong-password" });
    const unknownEmail = await request(app)
      .post("/api/auth/login")
      .send({ email: "nobody@example.com", password: PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.message).toBe(unknownEmail.body.message);
  });
});

describe("GET /api/auth/me", () => {
  it("needs a session", async () => {
    expect((await request(app).get("/api/auth/me")).status).toBe(401);
  });

  it("returns the signed-in account", async () => {
    const agent = await signedInAgent();

    const response = await agent.get("/api/auth/me");

    expect(response.status).toBe(200);
    expect(response.body.user.email).toBe("asha@example.com");
  });
});

describe("POST /api/auth/logout", () => {
  it("ends the session", async () => {
    const agent = await signedInAgent();

    await agent.post("/api/auth/logout").send({});

    expect((await agent.get("/api/auth/me")).status).toBe(401);
  });

  it("refuses requests that are not JSON, so other sites cannot post forms", async () => {
    const agent = await signedInAgent();

    const response = await agent
      .post("/api/auth/logout")
      .set("Content-Type", "application/x-www-form-urlencoded")
      .send("x=1");

    expect(response.status).toBe(415);
  });
});
