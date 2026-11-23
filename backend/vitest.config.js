import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.js"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      NODE_ENV: "test",
      JWT_SECRET: "test-jwt-secret",
      INTERNAL_API_KEY: "test-internal-key",
      AI_SERVICE_URL: "http://ai-service.test",
      MONGO_DB_URI: "mongodb://set-by-test-setup",
      FRONTEND_URL: "http://localhost:3000",
      ADMIN_EMAILS: "admin@voyagent.test",    },
  },
});
