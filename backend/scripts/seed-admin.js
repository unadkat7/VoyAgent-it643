// Creates the admin account (or resets its password). Reads ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD.
import mongoose from "mongoose";
import { z } from "zod";
import { env } from "../src/config/env.js";
import connectDB from "../src/config/db.js";
import { seedAdmin } from "../src/services/admin.service.js";

const seed = z
  .object({
    ADMIN_SEED_EMAIL: z.string().trim().toLowerCase().pipe(z.email()),
    ADMIN_SEED_PASSWORD: z.string().min(8).max(72),
  })
  .safeParse(process.env);

if (!seed.success) {
  console.error("Set ADMIN_SEED_EMAIL and ADMIN_SEED_PASSWORD (8-72 characters) first.");
  process.exit(1);
}
const { ADMIN_SEED_EMAIL: email, ADMIN_SEED_PASSWORD: password } = seed.data;
if (!env.adminEmails.includes(email)) {
  console.error("ADMIN_SEED_EMAIL must also be listed in ADMIN_EMAILS.");
  process.exit(1);
}

await connectDB(env.MONGO_DB_URI);
await seedAdmin({ email, password });
console.log("Admin account ready.");
await mongoose.disconnect();
