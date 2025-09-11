import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    // use jsdom for react testing-library
    environment: "jsdom",
    include: ["src/renderer-app/test/**/*.test.{ts,tsx}"],
    // avoid trying to load the project's vite.config.ts during bundling
    deps: {
      inline: [],
    },
  },
});
