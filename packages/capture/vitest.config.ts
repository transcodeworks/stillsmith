import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // The e2e suite starts a Vite server and drives a real Chromium; the unit
    // suite finishes in milliseconds and never notices these.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    /**
     * Both e2e files start a server against the same fixture app and wipe its
     * `.vite` dependency cache to get a cold start. Run them at the same time and
     * they clear the cache out from under each other. The suite is seconds long;
     * serialising it costs nothing worth having.
     */
    fileParallelism: false,
  },
});
