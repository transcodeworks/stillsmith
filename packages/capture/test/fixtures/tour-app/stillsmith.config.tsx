import { defineConfig } from "@stillsmith/capture/react";

/** The app the tour e2e tests drive: a real page at `/`, scenes beside it. */
export default defineConfig({
  scenes: ["src/scenes/*.scene.tsx"],
  tours: ["src/tours/*.tour.ts"],
  vite: "./vite.config.ts",

  presets: {
    test: { width: 400, height: 300 },
  },

  targets: {
    test: { outDir: "output" },
  },
});
