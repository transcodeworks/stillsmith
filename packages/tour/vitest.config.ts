import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The engine is browser code; jsdom covers everything that doesn't
    // measure layout. Geometry (spotlight cutouts, flip) is asserted in a
    // real browser by stillsmith's e2e suite, which owns the Playwright harness.
    environment: "jsdom",
    include: ["test/**/*.test.ts"],
    setupFiles: ["./test/setup.ts"],
  },
});
