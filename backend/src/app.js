import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { requireJson } from "./middleware/requireJson.js";
import authRoutes from "./routes/auth.routes.js";
import feedbackRoutes from "./routes/feedback.routes.js";
import statsRoutes from "./routes/stats.routes.js";
import tripRoutes from "./routes/trip.routes.js";
import { HttpError } from "./utils/httpError.js";

const app = express();

const allowedOrigins = new Set(["http://localhost:3000", "http://127.0.0.1:3000", ...env.frontendOrigins]);

// Render sits behind one proxy; this makes req.ip the real client for rate limits.
app.set("trust proxy", 1);

app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }
      return callback(new HttpError(403, "Origin not allowed"));
    },
    credentials: true,
  })
);
if (env.NODE_ENV !== "test") {
  app.use(morgan(env.isProduction ? "combined" : "dev"));
}
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use("/api", requireJson);
app.use("/api/auth", authRoutes);
app.use("/api/trips", tripRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/stats", statsRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
