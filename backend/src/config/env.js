import "dotenv/config";
import { z } from "zod";

// Imported first by server.js so every module sees a validated config, not raw process.env.
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(5000),
  MONGO_DB_URI: z.string().min(1),
  JWT_SECRET: z.string().min(12),
  INTERNAL_API_KEY: z.string().min(16),
  AI_SERVICE_URL: z.url().default("http://localhost:8000"),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  ADMIN_EMAILS: z.string().default(""),});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment variables:", z.flattenError(parsed.error).fieldErrors);
  throw new Error("Invalid environment configuration");
}

const splitList = (value) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export const env = Object.freeze({
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === "production",
  frontendOrigins: splitList(parsed.data.FRONTEND_URL),
  adminEmails: splitList(parsed.data.ADMIN_EMAILS).map((email) => email.toLowerCase()),
});
