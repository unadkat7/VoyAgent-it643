import request from "supertest";
import app from "../src/app.js";

export const PASSWORD = "correct-horse-battery";

// A supertest agent keeps the auth cookie between requests, like a browser.
export async function signedInAgent(email = "asha@example.com", name = "Asha") {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/signup").send({ name, email, password: PASSWORD });
  if (response.status !== 201) {
    throw new Error(`signup failed: ${response.status} ${JSON.stringify(response.body)}`);
  }
  return agent;
}
