import { defineConfig } from "@stillsmith/capture/react";

/**
 * Next-shaped app with `next` as an empty local stub (not the real package).
 * Host detection activates the next shim set; interception is total.
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
