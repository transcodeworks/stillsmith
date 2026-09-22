import { defineConfig } from "@stillsmith/capture/react";

/** The app fixture with a stand-in for @stillsmith/studio in
 * `viteOverrides.plugins`. `stillsmith dev` only checks the plugin's name. */
export default defineConfig({
  scenes: ["src/scenes/*.scene.tsx"],
  vite: "./vite.config.ts",

  presets: {
    test: { width: 400, height: 300 },
  },

  targets: {
    test: { outDir: "output" },
  },

  viteOverrides: {
    plugins: [{ name: "stillsmith:studio" }],
  },
});
