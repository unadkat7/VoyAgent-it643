import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { transformWithOxc } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    {
      name: "next-page-jsx",
      enforce: "pre",
      transform(code, id) {
        if (id.includes("/src/app/") && id.endsWith(".js")) {
          return transformWithOxc(code, id, { lang: "jsx", jsx: { runtime: "automatic" } });
        }
      },
    },
    react(),
  ],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.js"],
  },
});
