import { env } from "./config/env.js";
import app from "./app.js";
import connectDB from "./config/db.js";

try {
  await connectDB(env.MONGO_DB_URI);
} catch (error) {
  console.error("MongoDB connection failed:", error.message);
  process.exit(1);
}

app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`VoyAgent backend listening on port ${env.PORT}`);
});
