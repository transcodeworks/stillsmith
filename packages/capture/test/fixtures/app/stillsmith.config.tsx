import { defineConfig } from "@stillsmith/capture/react";

/**
 * The app the e2e tests drive. Small on purpose: a tiny viewport keeps the
 * screenshots fast, and every scene here exists to pin one failure mode rather
 * than to look like anything.
 */
export default defineConfig({
  scenes: ["src/scenes/*.scene.tsx"],
  vite: "./vite.config.ts",

  presets: {
    test: { width: 400, height: 300 },
  },

  targets: {
    test: { outDir: "output" },
  },
});
