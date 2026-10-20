import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes.js";
import tripRoutes from "./routes/trip.routes.js";

const app = express();

const defaultAllowedOrigins = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

const configuredOrigins = [
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
  process.env.CORS_ORIGIN,
]
  .filter(Boolean)
  .flatMap((origin) => origin.split(","))
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  ...defaultAllowedOrigins,
  ...configuredOrigins,
]);

app.set("trust proxy", 1);

// Requests from the web app need JSON bodies, cookies, and credentialed CORS.
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(new Error(`CORS blocked request from origin: ${origin}`));
    },
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

// Authentication owns account sessions and the current-user endpoint.
app.use("/api/auth", authRoutes);

// Trip routes are protected individually so ownership checks stay close to each action.
app.use("/api/trips", tripRoutes);

// Keep a small public endpoint for deployment health checks.
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "VoyAgent Backend is running 🚀",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
  });
});

export default app;


