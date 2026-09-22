import { defineConfig } from "@stillsmith/capture/react";

/** The app fixture with a target that filters on a tag no shot carries: every
 * shot is an orphan and the plan is empty. */
export default defineConfig({
  scenes: ["src/scenes/*.scene.tsx"],
  vite: "./vite.config.ts",

  presets: {
    test: { width: 400, height: 300 },
  },

  targets: {
    test: { outDir: "output", tags: ["never-tagged"] },
  },
});
