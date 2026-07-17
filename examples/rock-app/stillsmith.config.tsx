import { defineConfig } from "@stillsmith/capture/react";

// The app's own stylesheet, through the app's own `@` alias. In Node this
// resolves to an empty stub; in the browser it goes through the app's real CSS
// pipeline. That is what lets the whole config live in one file.
import "@/theme.css";

export default defineConfig({
  scenes: ["src/**/*.scene.tsx"],
  tours: ["src/tours/*.tour.ts"],
  vite: "./vite.config.ts",

  presets: {
    docs: { width: 1280, height: 800, dpr: 2, colorScheme: "dark" },
    light: { width: 1280, height: 800, dpr: 1, colorScheme: "light" },
    dark: { width: 1280, height: 800, dpr: 1, colorScheme: "dark" },
  },

  targets: {
    // Straight into the Starlight site. These images are committed — the docs
    // are built from them, so stillsmith's own documentation can never show a
    // stale UI. Lossless webp: Starlight re-encodes to webp at build time
    // anyway, and the source files stay far smaller in git than png.
    docs: {
      outDir: "../../docs/src/assets/shots",
      flat: true,
      presets: ["docs"],
      tags: ["docs"],
      format: "webp",
    },
    // Everything, both schemes. Scratch directory, gitignored.
    all: { outDir: "output", presets: ["light", "dark"] },
  },

  // The browser-side harness, inline. Never called in Node.
  wrapper: ({ children }) => <>{children}</>,

  applyColorScheme: (scheme) =>
    document.documentElement.classList.toggle("dark", scheme === "dark"),
});
