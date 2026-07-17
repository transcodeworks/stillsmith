import { defineConfig } from "@stillsmith/capture/react";

/**
 * No vite.config, no vite dependency — exercises tier-3 synthesis
 * (tsconfig paths + PostCSS auto-detect).
 */
export default defineConfig({
  scenes: ["src/scenes/*.scene.tsx"],

  presets: {
    test: { width: 400, height: 300 },
  },

  targets: {
    test: { outDir: "output" },
  },
});
