import request from "supertest";
import app from "../src/app.js";
import User from "../src/models/user.model.js";

export const PASSWORD = "correct-horse-battery";
export const ADMIN_EMAIL = "admin@voyagent.test";

// A supertest agent keeps the auth cookie between requests, like a browser.
export async function signedInAgent(email = "asha@example.com", name = "Asha") {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/signup").send({ name, email, password: PASSWORD });
  if (response.status !== 201) {
    throw new Error(`signup failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return agent;
}

// Admin accounts cannot sign up, so the test creates one the way the seed script does.
export async function adminAgent() {
  await User.create({ name: "Admin", email: ADMIN_EMAIL, password: PASSWORD });
  const agent = request.agent(app);
  await agent.post("/api/auth/login").send({ email: ADMIN_EMAIL, password: PASSWORD });
  return agent;
}
